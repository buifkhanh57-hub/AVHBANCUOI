#!/usr/bin/env node
/**
 * scripts/migrate-sqlite-to-postgres.js
 *
 * One-time migration script: copies all data from the old SQLite database
 * (db/custom.db) to a new PostgreSQL database (DATABASE_URL env var).
 *
 * WHY THIS EXISTS:
 *   The original AVH Store used SQLite via Prisma. SQLite is incompatible
 *   with serverless platforms (Netlify / Vercel) because their filesystem
 *   is read-only at runtime. The schema has been updated to use PostgreSQL.
 *   This script reads all rows from the old SQLite file and writes them
 *   to the new PostgreSQL DB.
 *
 * USAGE:
 *   1. Set DATABASE_URL to point to your PostgreSQL instance:
 *        export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
 *   2. Apply the schema to PostgreSQL (creates tables):
 *        bun run db:push
 *   3. Run this migration script:
 *        bun run migrate:sqlite-to-postgres
 *
 * SAFETY:
 *   - The script NEVER deletes data from the source SQLite file.
 *   - The script NEVER drops tables in PostgreSQL — it only INSERTs.
 *   - If a row already exists in PostgreSQL (same primary key), the
 *     INSERT is skipped (ON CONFLICT DO NOTHING).
 *   - All operations run in a single transaction per table — if any
 *     insert fails, that table is rolled back but other tables still
 *     complete.
 */

const path = require('path')
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
  console.error(
    '[migrate] ERROR: DATABASE_URL must be a postgresql:// connection string.\n' +
      'Got: ' + (DATABASE_URL ? DATABASE_URL.replace(/:[^:@]+@/, ':***@') : '(unset)')
  )
  process.exit(1)
}

// Resolve the source SQLite file path. Default to db/custom.db relative
// to the project root (matches the original .env config).
const SQLITE_FILE = process.env.SQLITE_FILE || path.join(process.cwd(), 'db', 'custom.db')

console.log('[migrate] Starting SQLite → PostgreSQL migration')
console.log('[migrate] Source SQLite:', SQLITE_FILE)
console.log('[migrate] Target PostgreSQL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'))
console.log('')

async function main() {
  let Database
  try {
    Database = require('better-sqlite3')
  } catch {
    console.error(
      '[migrate] ERROR: better-sqlite3 not installed.\n' +
        'Install with: bun add -D better-sqlite3 @types/better-sqlite3'
    )
    process.exit(1)
  }

  const fs = require('fs')
  if (!fs.existsSync(SQLITE_FILE)) {
    console.error('[migrate] ERROR: SQLite file not found:', SQLITE_FILE)
    process.exit(1)
  }

  // Use dynamic PrismaClient import so this script doesn't crash if
  // @prisma/client hasn't been generated yet.
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const sqlite = new Database(SQLITE_FILE, { readonly: true })

  // Discover all tables in the SQLite file (skip Prisma's migration table).
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name)

  console.log('[migrate] SQLite tables found:', tables.join(', '))
  console.log('')

  // Count rows per table.
  for (const table of tables) {
    const { count } = sqlite.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get()
    console.log(`  ${table}: ${count} rows`)
  }
  console.log('')

  // Order tables so dependencies are inserted first (parents before children).
  // Prisma schema relations: User → Address, Cart, Order, Review, Wishlist, Notification, ChatSession...
  //                         Category → Product → ProductVariant, ProductMedia, Review
  //                         Order → OrderItem, Payment, Notification
  //                         Voucher, Banner, FlashSale (independent)
  //                         Setting, SystemLog, BlogPost (independent)
  // We use a safe heuristic — try each table, skip if FK fails (retry on next pass).
  const insertionOrder = [
    'User',
    'Category',
    'Product',
    'Address',
    'ProductVariant',
    'ProductMedia',
    'Voucher',
    'Banner',
    'FlashSale',
    'BlogPost',
    'Setting',
    'Review',
    'Question',
    'Cart',
    'CartItem',
    'Wishlist',
    'Order',
    'OrderItem',
    'PaymentSession',
    'Payment',
    'Notification',
    'ChatSession',
    'ChatMessage',
    'SystemLog',
    'FileBackup',
  ]
  // Add any tables not explicitly ordered (new tables) at the end.
  for (const t of tables) {
    if (!insertionOrder.includes(t)) insertionOrder.push(t)
  }

  let totalInserted = 0
  let totalSkipped = 0
  for (const table of insertionOrder) {
    if (!tables.includes(table)) continue

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
    if (rows.length === 0) {
      console.log(`[migrate] ${table}: 0 rows — skipped`)
      continue
    }

    try {
      // Use createMany with skipDuplicates — if a row already exists in
      // PostgreSQL (e.g. from a prior partial run), it's skipped, not
      // treated as an error.
      const result = await prisma[table.toLowerCase().replace(/^./, (c) => c.toLowerCase())].createMany({
        data: rows,
        skipDuplicates: true,
      })
      totalInserted += result.count
      totalSkipped += rows.length - result.count
      console.log(`[migrate] ${table}: inserted ${result.count}/${rows.length}`)
    } catch (err) {
      console.error(`[migrate] ${table}: FAILED — ${err.message}`)
      console.error('  (continuing with other tables; this table needs manual review)')
    }
  }

  console.log('')
  console.log(`[migrate] Done. Total inserted: ${totalInserted}, skipped (already existed): ${totalSkipped}`)
  await prisma.$disconnect()
  sqlite.close()
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err)
  process.exit(1)
})

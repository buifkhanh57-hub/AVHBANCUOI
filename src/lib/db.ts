import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ── Supabase pooler (PgBouncer) compatibility ────────────────────────────
//
// Supabase's connection pooler (port 6543) runs PgBouncer in "transaction
// mode". In transaction mode, prepared statements DON'T WORK because each
// transaction may be routed to a different backend connection, and prepared
// statements are connection-scoped.
//
// Prisma uses prepared statements by default → causes the error:
//   "prepared statement 's151' does not exist" (PostgreSQL error 26000)
//
// Fix: set `pgbouncer=true` + `statement_cache_size=0` in the connection
// string. This tells Prisma to disable prepared statements.
//
// The `?pgbouncer=true&statement_cache_size=0` query params are appended
// automatically if the DATABASE_URL points to Supabase pooler (port 6543).
// Operators who use a direct connection (port 5432) or non-Supabase DB
// don't need these params — but they don't hurt either.

function buildDatasourceUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) return url

  // Already has pgbouncer param — no need to add
  if (url.includes('pgbouncer=')) return url

  // Append the params — works for both Supabase pooler (6543) and direct (5432)
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}pgbouncer=true&statement_cache_size=0`
}

const datasourceUrl = buildDatasourceUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep logging quiet in dev to reduce memory/CPU overhead.
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

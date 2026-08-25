import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ── DATABASE_URL normalization for Supabase Supavisor ─────────────────────
//
// WHY:
//   Supabase recently migrated to Supavisor as the default connection layer.
//   Supavisor sits in front of PostgreSQL and REQUIRES the username to
//   include the project reference, e.g. `postgres.abc123` instead of just
//   `postgres`. Older connection strings (and the ones our operator set)
//   use just `postgres` as the username, which Supavisor rejects with:
//
//     FATAL: (EINVALIDUSERINFO) Authentication error,
//            reason: "Invalid format for user or db_name"
//
//   This caused EVERY /api/* route that hits the DB to fail with HTTP 500
//   on Railway (the home page rendered because it's statically built, but
//   /api/auth/login, /api/products, /api/admin/stats all crashed).
//
// WHAT THIS DOES:
//   1. Parses DATABASE_URL.
//   2. If the URL points to a Supabase host (*.supabase.co), extracts the
//      project reference from the hostname (e.g. `db.abc123.supabase.co`
//      → `abc123`).
//   3. If the username is just `postgres` (no dot), appends `.PROJECT-REF`
//      so Supavisor accepts the connection.
//   4. URL-encodes the password defensively (handles `@` and other special
//      chars in passwords — Supabase passwords often contain `@`).
//
// This is a NO-OP for:
//   - Non-Supabase URLs (left untouched)
//   - URLs that already include the project ref in the username
//   - URLs that already have URL-encoded passwords
//
// IMPORTANT: this does NOT modify the env var — it only normalizes the URL
// at runtime before passing to Prisma. The operator's DATABASE_URL on
// Railway is left untouched.

function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl)
    const isSupabase =
      u.hostname.endsWith('.supabase.co') ||
      u.hostname.endsWith('.pooler.supabase.com')
    if (!isSupabase) return rawUrl

    // If username already has a dot (e.g. `postgres.abc123`), it's already
    // in the Supavisor-compatible format — leave it alone.
    if (u.username.includes('.')) return u.toString()

    // Extract project ref from hostname.
    // Direct: db.PROJECT-REF.supabase.co
    //   hostParts = ['db', 'PROJECT-REF', 'supabase', 'co']
    //   → projectRef = hostParts[1]
    const hostParts = u.hostname.split('.')
    let projectRef = ''
    if (u.hostname.endsWith('.supabase.co') && hostParts.length >= 4) {
      projectRef = hostParts[1]
    }
    if (!projectRef) return u.toString()

    // Append project ref to username → `postgres.PROJECT-REF`
    u.username = `${u.username}.${projectRef}`

    // u.toString() properly URL-encodes the password (handles `@` → `%40`).
    // PgBouncer transaction-mode compatibility — Supavisor uses PgBouncer
    // under the hood, which doesn't support prepared statements. Adding
    // these params tells Prisma to disable prepared statements, preventing
    // "prepared statement sN does not exist" errors.
    const search = u.searchParams
    if (!search.has('pgbouncer')) search.set('pgbouncer', 'true')
    if (!search.has('statement_cache_size')) search.set('statement_cache_size', '0')

    return u.toString()
  } catch {
    // URL parse failed — return as-is so Prisma can report the original error.
    return rawUrl
  }
}

const datasourceUrl = normalizeSupabaseUrl(process.env.DATABASE_URL || '')

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

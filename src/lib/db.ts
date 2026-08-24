import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ── Prisma + Supabase pooler (PgBouncer) compatibility ───────────────────
//
// Supabase's connection pooler (port 6543) runs PgBouncer in transaction mode.
// This causes 2 issues:
//
// 1. Prepared statements don't work (PgBouncer routes each transaction to a
//    different backend connection, but prepared statements are
//    connection-scoped). Prisma's default → "prepared statement s151 does
//    not exist" (PostgreSQL error 26000).
//    Fix: append ?pgbouncer=true&statement_cache_size=0 to DATABASE_URL.
//
// 2. Password with special chars (@, #, ?, /, etc.) breaks Prisma's URL
//    parser. The connection string format is:
//      postgresql://USER:PASSWORD@HOST:PORT/DATABASE
//    If PASSWORD contains '@', Prisma parses the URL and treats the part
//    after the first '@' as the host — totally wrong.
//    Fix: URL-encode the password. We extract user+password from the URL
//    via regex, URL-encode the password (%40 for '@'), and rebuild.
//
// This module handles BOTH issues automatically — the operator just sets
// DATABASE_URL with the raw password (e.g. 'Khanh2009@Apple') and this
// code transforms it into a valid Prisma datasource URL.

function encodePasswordInUrl(url: string): string {
  // Match: postgresql://USER:PASSWORD@HOST:PORT/DB
  // The PASSWORD can contain '@' (common in passwords like 'Khanh2009@Apple').
  // Strategy: split at the FIRST '@' after the password, but PASSWORD itself
  // may contain '@'. So we split at the LAST '@' in the user:password@host
  // segment — that '@' is the one separating password from host.
  //
  // Approach: find the position of `://` first, then take everything after
  // it as `userinfo@hostpart`. Split userinfo@hostpart at the LAST '@'
  // (because host can't contain '@', so the last '@' is definitely the
  // password-host separator).
  const schemeMatch = url.match(/^(postgresql:\/\/)(.+)$/)
  if (!schemeMatch) return url

  const [, scheme, afterScheme] = schemeMatch
  // Find the LAST '@' in the part after `://`. Everything before it is
  // `userinfo` (user:password); everything after is `hostpart` (host:port/db).
  const lastAt = afterScheme.lastIndexOf('@')
  if (lastAt === -1) return url // no userinfo

  const userinfo = afterScheme.substring(0, lastAt) // e.g. "user:Khanh2009@Apple"
  const hostpart = afterScheme.substring(lastAt + 1) // e.g. "host:5432/db"

  // Split userinfo at the FIRST ':' to get user + password
  const colonIdx = userinfo.indexOf(':')
  if (colonIdx === -1) return url // no password

  const user = userinfo.substring(0, colonIdx)
  const password = userinfo.substring(colonIdx + 1)
  // URL-encode the password — encodeURIComponent handles '@', '#', '?',
  // '/', '&', '+', spaces, and unicode chars.
  const encodedPassword = encodeURIComponent(password)

  return `${scheme}${user}:${encodedPassword}@${hostpart}`
}

function buildDatasourceUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) return url

  // Step 1: URL-encode the password (handles '@' in password like 'Khanh2009@Apple')
  let result = encodePasswordInUrl(url)

  // Step 2: Append pgbouncer params if not already present
  if (!result.includes('pgbouncer=')) {
    const separator = result.includes('?') ? '&' : '?'
    result = `${result}${separator}pgbouncer=true&statement_cache_size=0`
  }

  return result
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

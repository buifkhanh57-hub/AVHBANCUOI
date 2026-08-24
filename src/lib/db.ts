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
//    different backend connection, but prepared statements are connection-scoped).
//    Fix: append ?pgbouncer=true&statement_cache_size=0 to DATABASE_URL.
//
// 2. Password with special chars (@, #, ?, /, etc.) breaks Prisma's URL
//    parser. The connection string format is:
//      postgresql://USER:PASSWORD@HOST:PORT/DATABASE
//    If PASSWORD contains '@', Prisma parses the URL wrong.
//    Fix: URL-encode the password.
//
// This module updates process.env.DATABASE_URL BEFORE PrismaClient is
// instantiated. This works because Prisma reads the env var at client init
// time, not at module import time.

function encodePasswordInUrl(url: string): string {
  const schemeMatch = url.match(/^(postgresql:\/\/)(.+)$/)
  if (!schemeMatch) return url
  const [, scheme, afterScheme] = schemeMatch
  const lastAt = afterScheme.lastIndexOf('@')
  if (lastAt === -1) return url
  const userinfo = afterScheme.substring(0, lastAt)
  const hostpart = afterScheme.substring(lastAt + 1)
  const colonIdx = userinfo.indexOf(':')
  if (colonIdx === -1) return url
  const user = userinfo.substring(0, colonIdx)
  const password = userinfo.substring(colonIdx + 1)
  const encodedPassword = encodeURIComponent(password)
  return `${scheme}${user}:${encodedPassword}@${hostpart}`
}

function buildDatasourceUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) return url
  let result = encodePasswordInUrl(url)
  if (!result.includes('pgbouncer=')) {
    const separator = result.includes('?') ? '&' : '?'
    result = `${result}${separator}pgbouncer=true&statement_cache_size=0`
  }
  return result
}

// Override process.env.DATABASE_URL with the fixed version BEFORE PrismaClient init.
// This is the most reliable way — Prisma's env var lookup happens at init time.
const fixedUrl = buildDatasourceUrl()
if (fixedUrl && fixedUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = fixedUrl
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

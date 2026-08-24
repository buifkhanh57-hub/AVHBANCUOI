import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ── Prisma + Supabase pooler (PgBouncer) compatibility ───────────────────
//
// This module ensures the DATABASE_URL is properly formatted for Prisma +
// Supabase's connection pooler (PgBouncer in transaction mode on port 6543).
//
// It handles:
// 1. Password encoding: if the password contains raw special chars (like '@')
//    but is NOT already URL-encoded, encode it. If already encoded (%40 etc.),
//    leave it as-is to avoid double-encoding.
// 2. PgBouncer params: append ?pgbouncer=true&statement_cache_size=0 if not
//    already present. Required for Supabase pooler (port 6543) which doesn't
//    support prepared statements in transaction mode.

function needsEncoding(password: string): boolean {
  // If password has raw special chars that need encoding (@, #, ?, /, etc.)
  // AND doesn't already have encoded sequences (%XX), it needs encoding.
  const hasRawSpecial = /[@#$&?\/\s]/.test(password)
  const hasEncoded = /%[0-9A-Fa-f]{2}/.test(password)
  return hasRawSpecial && !hasEncoded
}

function processDatabaseUrl(url: string): string {
  if (!url) return url

  // Step 1: If URL already has pgbouncer param, assume it's fully configured
  // by the operator — use as-is.
  if (url.includes('pgbouncer=')) return url

  // Step 2: Encode password if needed
  const schemeMatch = url.match(/^(postgresql:\/\/)(.+)$/)
  if (schemeMatch) {
    const [, scheme, afterScheme] = schemeMatch
    const lastAt = afterScheme.lastIndexOf('@')
    if (lastAt !== -1) {
      const userinfo = afterScheme.substring(0, lastAt)
      const hostpart = afterScheme.substring(lastAt + 1)
      const colonIdx = userinfo.indexOf(':')
      if (colonIdx !== -1) {
        const user = userinfo.substring(0, colonIdx)
        let password = userinfo.substring(colonIdx + 1)
        if (needsEncoding(password)) {
          password = encodeURIComponent(password)
        }
        url = `${scheme}${user}:${password}@${hostpart}`
      }
    }
  }

  // Step 3: Append pgbouncer params
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}pgbouncer=true&statement_cache_size=0`
}

const datasourceUrl = processDatabaseUrl(process.env.DATABASE_URL || '')

// Override process.env.DATABASE_URL BEFORE PrismaClient init.
if (datasourceUrl && datasourceUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = datasourceUrl
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

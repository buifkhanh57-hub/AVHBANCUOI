import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// SIMPLE: just use process.env.DATABASE_URL as-is.
// The operator must set DATABASE_URL with a properly formatted PostgreSQL
// connection string, including URL-encoded password if it contains special
// characters (e.g. '@' → '%40').
//
// Example:
//   DATABASE_URL=postgresql://postgres:Khanh2009%40Apple@db.xxx.supabase.co:5432/postgres
//
// No code-level URL manipulation — this avoids double-encoding bugs and
// ensures Prisma reads exactly what the operator set.

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

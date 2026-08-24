import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-token'

/**
 * Admin guard — call at the TOP of every admin API route handler.
 * Returns the auth payload (if admin) or a NextResponse error (if not).
 *
 * Usage:
 *   export async function POST(req: NextRequest) {
 *     const auth = await adminGuard(req)
 *     if (auth instanceof NextResponse) return auth
 *     // ... proceed with admin logic
 *   }
 */
export async function adminGuard(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const result = await requireAdmin(authHeader)
  if ('error' in result) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    )
  }
  return result // AuthPayload
}

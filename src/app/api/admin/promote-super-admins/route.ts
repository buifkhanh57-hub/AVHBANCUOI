import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminGuard } from '@/lib/middleware/admin-guard'
import { hashPassword } from '@/lib/password'
import { logInfo } from '@/lib/system-log'

/**
 * POST /api/admin/promote-super-admins
 *
 * One-time setup endpoint: promote specific Gmail accounts to ADMIN role
 * and reset their password to a known value. This is needed because the
 * Railway DB was seeded fresh (no historical users from sandbox).
 *
 * Auth: requires admin token (admin@avh.vn / admin123 by default).
 * After promotion, this endpoint can be removed (or kept disabled).
 *
 * Body: { password?: string } — defaults to "AVHSTORE@123"
 */
const TARGET_EMAILS = [
  'buifkhanh57@gmail.com',
  'nguyenanh2406@gmail.com',
  'duongyenavh@gmail.com',
  'buithimai11021987@gmail.com',
]

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const newPassword = String(body?.password || 'AVHSTORE@123')

  const results: Array<{ email: string; ok: boolean; action: string; message: string }> = []

  for (const email of TARGET_EMAILS) {
    try {
      const user = await db.user.findUnique({ where: { email } })
      if (!user) {
        // Create the user with ADMIN role + hashed password
        await db.user.create({
          data: {
            email,
            name: email.split('@')[0],
            role: 'ADMIN',
            passwordHash: hashPassword(newPassword),
            authProviders: 'email',
            memberTier: 'PLATINUM',
            loyaltyPoints: 0,
          },
        })
        results.push({ email, ok: true, action: 'created', message: `Tạo mới với role ADMIN + password "${newPassword}"` })
      } else {
        // Update existing user: promote to ADMIN + reset password
        await db.user.update({
          where: { id: user.id },
          data: {
            role: 'ADMIN',
            passwordHash: hashPassword(newPassword),
          },
        })
        results.push({ email, ok: true, action: 'updated', message: `Promote lên ADMIN + reset password "${newPassword}"` })
      }
    } catch (err) {
      results.push({
        email,
        ok: false,
        action: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  await logInfo('auth', `Super-admin promotion: ${results.filter(r => r.ok).length}/${TARGET_EMAILS.length} users promoted`, JSON.stringify(results))

  return NextResponse.json({
    success: true,
    data: { results },
  })
}

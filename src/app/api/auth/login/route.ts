import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signAuthToken } from '@/lib/auth-token'

/**
 * POST /api/auth/login { email, password }
 * Verifies the password against the stored scrypt hash. Falls back to a
 * plain-text compare for legacy demo users (which then get upgraded on
 * next password change). Returns the public user shape on success.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Thiếu email hoặc mật khẩu' }, { status: 400 })
  }
  const user = await db.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: false, error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
  }
  if (!verifyPassword(String(password), user.passwordHash)) {
    return NextResponse.json({ success: false, error: 'Email hoặc mật khẩu không đúng' }, { status: 401 })
  }
  const token = await signAuthToken({ userId: user.id, email: user.email, role: user.role })
  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      loyaltyPoints: user.loyaltyPoints,
      memberTier: user.memberTier,
      token,
    },
  })
}

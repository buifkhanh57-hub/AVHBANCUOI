import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signAuthToken } from '@/lib/auth-token'
import { hashPassword } from '@/lib/password'

/**
 * POST /api/auth/register — customer self-registration.
 * Body: { email, password, name?, phone? }
 *
 * Validates: email format, password strength, uniqueness. Hashes the
 * password with scrypt before storing. The new user is a CUSTOMER (not
 * admin — admins are seeded separately).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return NextResponse.json({ success: false, error: 'Thiếu email hoặc mật khẩu' }, { status: 400 })
  }
  const email = String(body.email).toLowerCase().trim()
  const password = String(body.password)
  const name = body.name ? String(body.name).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null

  // email format
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) {
    return NextResponse.json({ success: false, error: 'Email không hợp lệ' }, { status: 400 })
  }
  // password strength: >= 8 chars, has letter + number
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: 'Mật khẩu tối thiểu 8 ký tự' }, { status: 400 })
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ success: false, error: 'Mật khẩu phải có cả chữ và số' }, { status: 400 })
  }

  // uniqueness
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ success: false, error: 'Email đã được đăng ký. Vui lòng đăng nhập.' }, { status: 409 })
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      phone,
      passwordHash: hashPassword(password),
      role: 'CUSTOMER',
      authProviders: 'email',
    },
  })

  const token = await signAuthToken({ userId: user.id, email: user.email, role: user.role })
  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    },
  })
}

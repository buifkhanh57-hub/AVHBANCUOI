import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

/**
 * POST /api/auth/reset-password { email, newPassword }
 *
 * Customer self-service password reset (no email verification required —
 * this is a demo store without an SMTP relay). If the email exists in our
 * DB and belongs to a non-OAuth-only account, the password is replaced.
 *
 * For ADMIN accounts, the reset is refused — admins must contact another
 * admin to reset from the admin panel (audit trail preserved).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.newPassword) {
    return NextResponse.json(
      { success: false, error: 'Thiếu email hoặc mật khẩu mới' },
      { status: 400 }
    )
  }

  const email = String(body.email).toLowerCase().trim()
  const newPassword = String(body.newPassword)

  // email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Email không hợp lệ' }, { status: 400 })
  }

  // password strength: same rules as register
  if (newPassword.length < 8) {
    return NextResponse.json(
      { success: false, error: 'Mật khẩu tối thiểu 8 ký tự' },
      { status: 400 }
    )
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json(
      { success: false, error: 'Mật khẩu phải có cả chữ và số' },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    // do NOT leak which emails exist; return a soft success
    return NextResponse.json({
      success: true,
      data: { updated: false, message: 'Nếu email tồn tại, mật khẩu đã được cập nhật.' },
    })
  }

  // Block ADMIN password reset from the public endpoint (security hardening)
  if (user.role === 'ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: 'Tài khoản quản trị không thể tự đặt lại mật khẩu. Vui lòng liên hệ quản trị viên khác.',
      },
      { status: 403 }
    )
  }

  // OAuth-only accounts have no real password — refuse, ask them to sign in via OAuth
  if (!user.passwordHash) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tài khoản này đăng nhập qua mạng xã hội. Vui lòng dùng Google/Apple để đăng nhập.',
      },
      { status: 400 }
    )
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  })

  return NextResponse.json({
    success: true,
    data: {
      updated: true,
      message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập bằng mật khẩu mới.',
    },
  })
}

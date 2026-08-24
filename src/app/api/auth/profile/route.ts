import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromHeader } from '@/lib/auth-token'
import { logInfo } from '@/lib/system-log'

/**
 * PUT /api/auth/profile — update the logged-in user's profile (name, phone).
 * (Using PUT not PATCH because the frontend api wrapper sends PUT —
 *  `api.put()` maps to HTTP PUT. If we export PATCH, Next.js returns 405
 *  Method Not Allowed because the request is PUT, not PATCH.)
 *
 * Body: { name?: string, phone?: string }
 *
 * Auth: any logged-in user (CUSTOMER / ADMIN). The userId comes from the JWT
 * token, not from the request body — so a customer can only edit their own
 * profile, never someone else's.
 *
 * Returns the updated user object (without passwordHash).
 */
export async function PUT(req: NextRequest) {
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ success: false, error: 'Thiếu dữ liệu' }, { status: 400 })
  }

  const update: { name?: string; phone?: string } = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ success: false, error: 'Tên phải từ 2-100 ký tự' }, { status: 400 })
    }
    update.name = name
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim()
    if (phone && !/^0\d{9,10}$/.test(phone)) {
      return NextResponse.json({ success: false, error: 'Số điện thoại không hợp lệ (10-11 số, bắt đầu 0)' }, { status: 400 })
    }
    update.phone = phone || undefined
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: 'Không có trường nào để cập nhật' }, { status: 400 })
  }

  try {
    const updated = await db.user.update({
      where: { id: auth.userId },
      data: update,
      select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, loyaltyPoints: true, memberTier: true },
    })

    await logInfo('auth', `User ${auth.email} updated profile`, JSON.stringify({ fields: Object.keys(update) }))

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        // Return a new JWT token so the frontend can update the persisted
        // auth store with the new name (the token payload still has the
        // old name, but the frontend reads name from the response, not
        // the token — so this is just for completeness).
        token: undefined,  // token unchanged, frontend keeps the old one
      },
    })
  } catch (err: any) {
    console.error('profile update failed:', err)
    return NextResponse.json({ success: false, error: 'Cập nhật thất bại' }, { status: 500 })
  }
}

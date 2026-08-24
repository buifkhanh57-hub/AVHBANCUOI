import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromHeader } from '@/lib/auth-token'

/**
 * GET /api/addresses?userId=... — list addresses for a user (default first).
 * POST /api/addresses — create a new address.
 *
 * Auth: customer must be logged in (Bearer token from auth-store).
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 })
  }
  const userId = auth.userId
  const addresses = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ success: true, data: addresses })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 })
  }
  const userId = auth.userId
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ success: false, error: 'Thiếu dữ liệu' }, { status: 400 })
  }
  const { fullName, phone, province, district, ward, detail, isDefault } = body as {
    fullName?: string
    phone?: string
    province?: string
    district?: string
    ward?: string
    detail?: string
    isDefault?: boolean
  }
  if (!fullName || !phone || !province || !district || !ward || !detail) {
    return NextResponse.json({ success: false, error: 'Thiếu trường bắt buộc (fullName, phone, province, district, ward, detail)' }, { status: 400 })
  }

  // If this is set as default, unset the previous default
  return await db.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    }
    const addr = await tx.address.create({
      data: {
        userId,
        fullName: String(fullName).trim(),
        phone: String(phone).trim(),
        province: String(province).trim(),
        district: String(district).trim(),
        ward: String(ward).trim(),
        detail: String(detail).trim(),
        isDefault: !!isDefault,
      },
    })
    return addr
  }).then((addr) => NextResponse.json({ success: true, data: addr }))
    .catch((err) => {
      console.error('create address failed:', err)
      return NextResponse.json({ success: false, error: 'Tạo địa chỉ thất bại' }, { status: 500 })
    })
}

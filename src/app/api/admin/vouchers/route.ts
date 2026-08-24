import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/system-log'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * POST /api/admin/vouchers — create a voucher.
 * PATCH /api/admin/vouchers?id=ID — update.
 * DELETE /api/admin/vouchers?id=ID — delete.
 *
 * Types: PERCENT (giảm %), FIXED (giảm số tiền cố định), FREE_SHIP (miễn phí ship).
 */
export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body?.code || !body?.type || body?.value == null) {
    return NextResponse.json({ success: false, error: 'Thiếu mã, loại hoặc giá trị voucher' }, { status: 400 })
  }
  // Validate — SQLite INT maxes out at ~2.1 billion. Reject anything larger
  // to prevent P2023 "Conversion failed" crashes on read.
  const MAX_VAL = 2_000_000_000
  if (Number(body.value) > MAX_VAL || (body.minOrder && Number(body.minOrder) > MAX_VAL) || (body.maxDiscount && Number(body.maxDiscount) > MAX_VAL)) {
    return NextResponse.json({ success: false, error: 'Giá trị voucher quá lớn (tối đa 2 tỷ)' }, { status: 400 })
  }
  const code = String(body.code).toUpperCase().trim()
  const existing = await db.voucher.findUnique({ where: { code } })
  if (existing) {
    return NextResponse.json({ success: false, error: 'Mã voucher đã tồn tại' }, { status: 409 })
  }
  const voucher = await db.voucher.create({
    data: {
      code,
      description: String(body.description || ''),
      type: String(body.type), // PERCENT | FIXED | FREE_SHIP
      value: Number(body.value),
      minOrder: Number(body.minOrder || 0),
      maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : null,
      usageLimit: Number(body.usageLimit || 0),
      startAt: new Date(body.startAt || Date.now()),
      endAt: new Date(body.endAt || Date.now() + 90 * 86400000),
      active: body.active !== false,
    },
  })
  logInfo('settings', `Tạo voucher ${code} (${body.type})`)
  return NextResponse.json({ success: true, data: { id: voucher.id } })
}

export async function PATCH(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
  const data: Record<string, unknown> = {}
  for (const k of ['description', 'type', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'active']) {
    if (k in body) data[k] = body[k]
  }
  if (body.startAt) data['startAt'] = new Date(body.startAt)
  if (body.endAt) data['endAt'] = new Date(body.endAt)
  await db.voucher.update({ where: { id }, data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })
  await db.voucher.delete({ where: { id } })
  logInfo('settings', `Xoá voucher id=${id}`)
  return NextResponse.json({ success: true })
}

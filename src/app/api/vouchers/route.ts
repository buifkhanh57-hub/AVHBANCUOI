import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/vouchers?code=CODE&subtotal=5000000 — validate a voucher for a cart subtotal
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const code = sp.get('code')?.toUpperCase()
  const subtotal = Number(sp.get('subtotal') || 0)

  if (!code) {
    const all = await db.voucher.findMany({ where: { active: true } })
    return NextResponse.json({ success: true, data: all })
  }

  const voucher = await db.voucher.findUnique({ where: { code } })
  if (!voucher || !voucher.active) {
    return NextResponse.json({ success: false, error: 'Mã không hợp lệ' }, { status: 404 })
  }
  const now = new Date()
  if (now < voucher.startAt || now > voucher.endAt) {
    return NextResponse.json({ success: false, error: 'Mã đã hết hạn' }, { status: 400 })
  }
  if (subtotal < voucher.minOrder) {
    return NextResponse.json(
      { success: false, error: `Đơn hàng tối thiểu ${voucher.minOrder.toLocaleString('vi-VN')}₫` },
      { status: 400 }
    )
  }

  // compute discount
  let discount = 0
  if (voucher.type === 'PERCENT') {
    discount = Math.round((subtotal * voucher.value) / 100)
    if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount)
  } else if (voucher.type === 'FREE_SHIP') {
    // Free ship — discount = maxDiscount (the ship fee cap) or a default
    discount = voucher.maxDiscount || voucher.value || 150000
  } else {
    // FIXED
    discount = voucher.value
  }

  return NextResponse.json({
    success: true,
    data: {
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      value: voucher.value,
      discount,
    },
  })
}

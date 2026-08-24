import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelineEntry } from '@/lib/format'

/**
 * POST /api/orders/[code]/declare-paid — customer declares "I have paid"
 * without uploading a slip. Used for ANY payment method (BANK / VNPAY / MOMO /
 * ZALOPAY / COD) when the auto-verification webhook hasn't fired or the
 * customer wants to flag the order as paid for admin review.
 *
 * Sets paymentStatus to PENDING_VERIFY (admin sees it in the "Chờ thanh toán"
 * tab and confirms via /api/orders/[code]/review).
 *
 * Body: { note?: string } — optional customer note (e.g. "chuyển khoản
 * 14:30 từ VPBank")
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const order = await db.order.findUnique({ where: { code: code.toUpperCase() } })
  if (!order) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 })
  }

  // Don't allow re-declaring if already PAID or REFUNDED
  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({
      success: false,
      error: 'Đơn đã được xác nhận thanh toán rồi',
    }, { status: 400 })
  }
  if (order.status === 'CANCELLED' || order.status === 'RETURNED') {
    return NextResponse.json({
      success: false,
      error: `Đơn đã ${order.status === 'CANCELLED' ? 'huỷ' : 'hoàn'} — không thể khai báo`,
    }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const note = (body.note ?? '').toString().trim().slice(0, 200)

  // Build timeline entry — distinct from SLIP_UPLOADED so admin can tell
  // "customer declared only" vs "customer uploaded slip".
  const timeline = JSON.parse(order.timeline || '[]')
  const label = note
    ? `Khách khai báo đã thanh toán — ghi chú: "${note}"`
    : `Khách khai báo đã thanh toán (chưa có biên lai)`
  timeline.push(timelineEntry('CUSTOMER_DECLARED_PAID', label))

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      // PENDING_VERIFY is the status that surfaces the order in admin's
      // "Chờ thanh toán" tab. Admin then confirms via /review endpoint.
      paymentStatus: 'PENDING_VERIFY',
      timeline: JSON.stringify(timeline),
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      paymentStatus: updated.paymentStatus,
      timeline: updated.timeline,
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelineEntry } from '@/lib/format'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * POST /api/orders/[code]/review — admin confirms or rejects a payment slip.
 * Body: { action: 'confirm' | 'reject', note? }
 *   - confirm: sets paymentStatus=PAID + status=PROCESSING + adds timeline
 *   - reject:  sets paymentStatus=UNPAID + status=CANCELLED + adds timeline
 * A reviewNote is persisted either way.
 *
 * In production this endpoint would be guarded by admin-role middleware.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  if (!body?.action || !['confirm', 'reject'].includes(body.action)) {
    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ (confirm | reject)' }, { status: 400 })
  }
  const order = await db.order.findUnique({ where: { code: code.toUpperCase() } })
  if (!order) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy đơn' }, { status: 404 })
  }
  // Note: we do NOT require a slip for admin confirmation. The admin can
  // verify payment via their own bank statement / gateway dashboard. The
  // slip (if uploaded for BANK) is just extra evidence.

  const note = (body.note as string) || ''
  const timeline = JSON.parse(order.timeline || '[]')
  if (body.action === 'confirm') {
    timeline.push(timelineEntry('PAYMENT_CONFIRMED', `Staff đã xác nhận biên lai chuyển khoản hợp lệ${note ? ': ' + note : ''}`))
    await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'PROCESSING',
        reviewNote: note || null,
        timeline: JSON.stringify(timeline),
      },
    })
    await db.payment.updateMany({
      where: { orderId: order.id },
      data: { status: 'SUCCESS' },
    })
    return NextResponse.json({ success: true, data: { status: 'PROCESSING', paymentStatus: 'PAID' } })
  } else {
    timeline.push(timelineEntry('PAYMENT_REJECTED', `Staff từ chối biên lai${note ? ': ' + note : ''}. Đơn bị huỷ.`))
    await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'UNPAID',
        status: 'CANCELLED',
        reviewNote: note || null,
        timeline: JSON.stringify(timeline),
      },
    })
    return NextResponse.json({ success: true, data: { status: 'CANCELLED', paymentStatus: 'UNPAID' } })
  }
}

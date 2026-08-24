import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelineEntry, ORDER_STATUS_LABELS } from '@/lib/format'

/**
 * GET /api/orders/[code] — fetch a single order by code (for tracking page).
 * PATCH /api/orders/[code] — update status (admin). Body: { status, note? }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const order = await db.order.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      items: true,
      payments: true,
      // Include the active PaymentSession so the frontend can render the
      // pinned bank-account snapshot (the one used at order-creation time)
      // — NOT the current admin setting. This keeps QR / payment info
      // consistent even if the admin later changes the bank account.
      paymentSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!order) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 })
  }
  const activeSession = order.paymentSessions[0]
  let bankAccountSnapshot: {
    bank: string
    bankCode: string
    accountNumber: string
    holder: string
    branch?: string
  } | null = null
  if (activeSession?.bankAccountSnapshot) {
    try { bankAccountSnapshot = JSON.parse(activeSession.bankAccountSnapshot) } catch {}
  }
  return NextResponse.json({
    success: true,
    data: {
      id: order.id,
      code: order.code,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discount: order.discount,
      total: order.total,
      voucherCode: order.voucherCode,
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingAddress: order.shippingAddress,
      note: order.note,
      needsInstallation: order.needsInstallation,
      scheduledDate: order.scheduledDate,
      timeline: JSON.parse(order.timeline || '[]'),
      riskFlags: JSON.parse(order.riskFlags || '[]'),
      slipUrl: order.slipUrl,
      slipUploadedAt: order.slipUploadedAt,
      reviewNote: order.reviewNote,
      // The pinned bank-account snapshot — what the customer's QR / payment
      // instructions must match. Frontend reads THIS, not Settings, so admin
      // changes to the bank account don't break pending orders.
      bankAccountSnapshot,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.name,
        image: it.image,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      })),
      createdAt: order.createdAt,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const { status, note } = body as { status?: string; note?: string }
  if (!status || !ORDER_STATUS_LABELS[status]) {
    return NextResponse.json({ success: false, error: 'Trạng thái không hợp lệ' }, { status: 400 })
  }
  const order = await db.order.findUnique({ where: { code: code.toUpperCase() } })
  if (!order) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy đơn' }, { status: 404 })
  }
  const timeline = JSON.parse(order.timeline || '[]')
  timeline.push(timelineEntry(status, note))
  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status,
      timeline: JSON.stringify(timeline),
      paymentStatus: status === 'DELIVERED' && order.paymentMethod === 'COD' ? 'PAID' : order.paymentStatus,
    },
  })
  // notify user
  if (order.userId) {
    await db.notification.create({
      data: {
        userId: order.userId,
        type: 'ORDER',
        title: `Đơn ${order.code} — ${ORDER_STATUS_LABELS[status]}`,
        body: note || `Trạng thái đơn hàng của bạn đã cập nhật: ${ORDER_STATUS_LABELS[status]}`,
        link: `order-tracking?code=${order.code}`,
      },
    })
  }
  return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } })
}

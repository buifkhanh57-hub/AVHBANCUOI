import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatVND, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/format'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/pending-payments — list all orders with PENDING_VERIFY
 * payment status (customers who haven't completed payment yet).
 * Admin uses this to manually confirm payments (anti-scam backup).
 */
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const orders = await db.order.findMany({
    where: { paymentStatus: 'PENDING_VERIFY' },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { name: true, quantity: true, image: true } } },
    take: 50,
  })

  const data = orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod,
    total: o.total,
    totalLabel: formatVND(o.total),
    shippingName: o.shippingName,
    shippingPhone: o.shippingPhone,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, image: i.image })),
    slipUrl: o.slipUrl,
  }))

  return NextResponse.json({ success: true, data })
}

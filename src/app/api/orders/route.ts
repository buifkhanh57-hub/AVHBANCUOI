import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOrderCode, timelineEntry } from '@/lib/format'
import { FIXED_BANK_ACCOUNT } from '@/lib/fixed-bank-account'
import { getAuthFromHeader } from '@/lib/auth-token'
import { applyVoucherServerSide } from '@/lib/voucher'
import { shippingFeeFor } from '@/lib/shipping'
import { computeRiskFlags } from '@/lib/risk'

/**
 * POST /api/orders — create an order from the cart payload sent by the client.
 * Body:
 *  items: [{ productId, variantId, name, slug, image, color, material, size, unitPrice, quantity }]
 *  shippingName, shippingPhone, shippingAddress (province/district/ward/detail)
 *  paymentMethod, voucherCode?, note?, needsInstallation?, scheduledDate?
 *
 * Server re-validates prices against DB to prevent client-side tampering.
 */
export async function POST(req: NextRequest) {
  // ── AUTH REQUIRED ─────────────────────────────────────────────────────
  // Guests cannot create orders. The customer MUST have a JWT token
  // (from login / register / OAuth). This is the server-side enforcement
  // layer; the frontend (ProductCard + CartDrawer) also blocks guests
  // before they even reach this endpoint, but we re-check here because
  // someone could call the API directly with curl.
  const authHeader = req.headers.get('authorization')
  const auth = await getAuthFromHeader(authHeader)
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Vui lòng đăng nhập để đặt hàng. Khách vãng lai không thể tạo đơn.' },
      { status: 401 }
    )
  }
  // Use the authenticated userId from the JWT — ignore any `userId` field
  // in the request body (could be spoofed). The customer's order is
  // ALWAYS tied to the JWT user, never to a client-supplied id.
  const userId = auth.userId

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ success: false, error: 'Giỏ hàng trống' }, { status: 400 })
  }

  const {
    items,
    shippingName,
    shippingPhone,
    province,
    district,
    ward,
    detail,
    paymentMethod = 'COD',
    voucherCode,
    note,
    needsInstallation = false,
    scheduledDate,
  } = body as {
    items: Array<{
      productId: string
      variantId?: string
      quantity: number
    }>
    shippingName: string
    shippingPhone: string
    province: string
    district: string
    ward: string
    detail: string
    paymentMethod: string
    voucherCode?: string
    note?: string
    needsInstallation?: boolean
    scheduledDate?: string
    userId?: string
  }

  // validate shipping info
  if (!shippingName || !shippingPhone || !province || !district || !ward || !detail) {
    return NextResponse.json({ success: false, error: 'Thiếu thông tin giao hàng' }, { status: 400 })
  }

  // Re-validate prices server-side
  let subtotal = 0
  const orderItemsData: Array<{
    productId: string
    variantId: string | null
    name: string
    image: string
    unitPrice: number
    quantity: number
  }> = []
  for (const line of items) {
    const product = await db.product.findUnique({
      where: { id: line.productId },
      include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    })
    if (!product) {
      return NextResponse.json({ success: false, error: `Sản phẩm không tồn tại: ${line.productId}` }, { status: 400 })
    }
    let unitPrice = product.basePrice
    let variant: { id: string; productId: string; price: number; stock: number } | null = null
    if (line.variantId) {
      variant = await db.productVariant.findUnique({ where: { id: line.variantId } }) as { id: string; productId: string; price: number; stock: number } | null
      if (!variant || variant.productId !== product.id) {
        return NextResponse.json({ success: false, error: 'Biến thể không hợp lệ' }, { status: 400 })
      }
      unitPrice = variant.price
      if (variant.stock < line.quantity) {
        return NextResponse.json({ success: false, error: `Không đủ tồn kho cho ${product.name}` }, { status: 400 })
      }
    }
    subtotal += unitPrice * line.quantity
    orderItemsData.push({
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      image: product.media[0]?.url ?? '/products/placeholder.png',
      unitPrice,
      quantity: line.quantity,
    })
  }

  // Shipping fee (admin-configurable rates from DB settings)
  const shippingFee = await shippingFeeFor(province, subtotal, needsInstallation)

  // Min order validation
  const minOrderSetting = await db.setting.findUnique({ where: { key: 'min_order_amount' } })
  const minOrder = minOrderSetting?.value ? Number(minOrderSetting.value) : 1000
  if (subtotal < minOrder) {
    return NextResponse.json(
      { success: false, error: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}₫` },
      { status: 400 }
    )
  }

  // Voucher
  let discount = 0
  if (voucherCode) {
    const v = await applyVoucherServerSide(voucherCode.toUpperCase(), subtotal)
    if (!v.ok) {
      return NextResponse.json({ success: false, error: v.error }, { status: 400 })
    }
    discount = v.discount
  }

  const total = Math.max(0, subtotal + shippingFee - discount)
  // Generate a SePay-compatible order code (AVH + 6 digits, e.g. AVH123456).
  // Retry up to 5 times if the unique constraint fires (collision — extremely
  // unlikely with 1M combinations, but handle it safely).
  let code = generateOrderCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.order.findUnique({ where: { code }, select: { id: true } })
    if (!existing) break
    code = generateOrderCode()
  }
  const addressStr = `${detail}, ${ward}, ${district}, ${province}`

  // resolve address id if user has matching address
  let addressId: string | undefined
  if (userId) {
    const addr = await db.address.findFirst({
      where: {
        userId,
        fullName: shippingName,
        phone: shippingPhone,
        province,
        district,
        ward,
        detail,
      },
    })
    addressId = addr?.id
    // also save as an address if none yet
    if (!addr) {
      const newAddr = await db.address.create({
        data: {
          userId,
          fullName: shippingName,
          phone: shippingPhone,
          province,
          district,
          ward,
          detail,
          isDefault: false,
        },
      })
      addressId = newAddr.id
    }
  }

  // --- Automatic fraud / risk detection (computed BEFORE order create so
  // the flags are persisted with the order). Staff reviews in admin.
  const riskFlags = await computeRiskFlags({
    total,
    shippingPhone,
    shippingName,
    shippingAddress: addressStr,
    itemCount: orderItemsData.length,
    paymentMethod,
    userId,
  })

  // For electronic payments (BANK) the customer must pay BEFORE the order is
  // processed — no "pay on delivery". The order is created as PENDING_VERIFY;
  // the PaymentView shows a QR and polls until the payment-gateway webhook
  // flips it to PAID. Only COD keeps UNPAID (pay on delivery). This protects
  // against legal/fulfilment risk: we never ship goods for an unpaid electronic order.
  const ELECTRONIC_METHODS = new Set(['BANK'])
  const initialPaymentStatus =
    ELECTRONIC_METHODS.has(paymentMethod) ? 'PENDING_VERIFY' : 'UNPAID'

  // Snapshot the FIXED bank account at this moment — store it on the
  // PaymentSession so the customer's QR / payment instructions stay pinned to
  // this exact account even if the codebase later changes (defensive: the
  // account is already hardcoded, but the snapshot makes this invariant
  // explicit + auditable per-order).
  //
  // The bank account is FIXED and hardcoded in src/lib/fixed-bank-account.ts.
  // Admin CANNOT change it via Settings — POST /api/admin/settings rejects
  // any request touching `payment_bank_accounts` (403 BANK_ACCOUNT_LOCKED).
  let bankAccountSnapshot: string | null = null
  if (ELECTRONIC_METHODS.has(paymentMethod)) {
    bankAccountSnapshot = JSON.stringify({
      bank: FIXED_BANK_ACCOUNT.bank,
      bankCode: FIXED_BANK_ACCOUNT.bankCode,
      accountNumber: FIXED_BANK_ACCOUNT.accountNumber,
      holder: FIXED_BANK_ACCOUNT.holder,
      branch: FIXED_BANK_ACCOUNT.branch,
    })
  }

  // Create the Order + Payment + PaymentSession atomically inside ONE Prisma
  // transaction. If any step fails (e.g. duplicate code), nothing is written.
  // PaymentSession stores the immutable amount snapshot + payment_reference
  // so the webhook can later verify the bank/provider's callback matches
  // EXACTLY what we asked the customer to pay (anti-scam).
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        code,
        userId: userId || null,
        addressId: addressId || null,
        shippingName,
        shippingPhone,
        shippingAddress: addressStr,
        timeline: JSON.stringify([
          timelineEntry('PENDING', 'Đơn hàng vừa được tạo'),
          ...(riskFlags.length
            ? [timelineEntry('RISK', `${riskFlags.length} cờ rủi ro được phát hiện — staff cần kiểm tra`)]
            : []),
        ]),
        status: 'PENDING',
        subtotal,
        shippingFee,
        discount,
        total,
        voucherCode: voucherCode || null,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        note: note || null,
        needsInstallation,
        scheduledDate: scheduledDate || null,
        riskFlags: JSON.stringify(riskFlags),
        items: { create: orderItemsData },
      },
      include: { items: true },
    })

    // Legacy Payment row — kept for backward compat with admin panel + existing
    // queries. The new source of truth is PaymentSession (created next).
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: paymentMethod,
        amount: total,
        status: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
      },
    })

    // PaymentSession — for electronic payments only. COD has no session
    // (customer pays cash on delivery, no webhook will ever arrive).
    if (ELECTRONIC_METHODS.has(paymentMethod)) {
      await tx.paymentSession.create({
        data: {
          orderId: order.id,
          paymentReference: order.code, // 1:1 with order code for BANK (VietQR embeds it)
          provider: paymentMethod,
          amount: total, // IMMUTABLE — webhook must report this exact amount
          currency: 'VND',
          status: 'PENDING',
          bankAccountSnapshot, // PIN bank account info to this moment (admin changes don't affect this order)
          // Session expires in 15 minutes — bank transfer / VNPay QR must be
          // completed within this window. After expiry, webhook is rejected.
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      })
    }

    return { order, payment }
  })

  const order = result.order

  // decrement variant stock
  for (const line of items) {
    if (line.variantId) {
      await db.productVariant.update({
        where: { id: line.variantId },
        data: { stock: { decrement: line.quantity } },
      })
    }
    // increment soldCount
    await db.product.update({
      where: { id: line.productId },
      data: { soldCount: { increment: line.quantity } },
    })
  }

  // bump voucher usedCount
  if (voucherCode) {
    await db.voucher.update({
      where: { code: voucherCode.toUpperCase() },
      data: { usedCount: { increment: 1 } },
    })
  }

  // notification for user (if logged in)
  if (userId) {
    await db.notification.create({
      data: {
        userId,
        type: 'ORDER',
        title: `Đặt hàng thành công ${code}`,
        body: `Đơn ${code} đã được tiếp nhận. Chúng tôi sẽ liên hệ xác nhận trong 30 phút.`,
        link: `order-tracking?code=${code}`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      code: order.code,
      id: order.id,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      riskFlags: riskFlags.length ? riskFlags : undefined,
    },
  })
}

/**
 * GET /api/orders?code=CODE or ?email=... — fetch orders for tracking
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const code = sp.get('code')
  const userId = sp.get('userId')

  if (code) {
    const order = await db.order.findUnique({
      where: { code: code.toUpperCase() },
      include: { items: true, payments: true },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy đơn' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: shapeOrder(order) })
  }
  if (userId) {
    const orders = await db.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return NextResponse.json({ success: true, data: orders.map(shapeOrder) })
  }
  return NextResponse.json({ success: false, error: 'Thiếu mã đơn hoặc userId' }, { status: 400 })
}

interface ShapeableOrder {
  id: string
  code: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  shippingFee: number
  discount: number
  total: number
  voucherCode: string | null
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note: string | null
  needsInstallation: boolean
  scheduledDate: string | null
  timeline: string
  riskFlags: string | null
  slipUrl: string | null
  slipUploadedAt: Date | null
  reviewNote: string | null
  items: Array<{
    id: string
    name: string
    image: string
    unitPrice: number
    quantity: number
  }>
  createdAt: Date
}

function shapeOrder(o: ShapeableOrder) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    discount: o.discount,
    total: o.total,
    voucherCode: o.voucherCode,
    shippingName: o.shippingName,
    shippingPhone: o.shippingPhone,
    shippingAddress: o.shippingAddress,
    note: o.note,
    needsInstallation: o.needsInstallation,
    scheduledDate: o.scheduledDate,
    timeline: JSON.parse(o.timeline || '[]'),
    riskFlags: JSON.parse(o.riskFlags || '[]'),
    slipUrl: o.slipUrl,
    slipUploadedAt: o.slipUploadedAt,
    reviewNote: o.reviewNote,
    items: o.items.map((it) => ({
      id: it.id,
      name: it.name,
      image: it.image,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
    })),
    createdAt: o.createdAt,
  }
}

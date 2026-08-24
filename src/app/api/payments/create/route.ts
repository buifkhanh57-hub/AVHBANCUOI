import { NextRequest, NextResponse } from 'next/server'
import { createVnPayUrl } from '@/lib/payments/vnpay'
import { createMoMoPayment } from '@/lib/payments/momo'
import { createZaloPayPayment } from '@/lib/payments/zalopay'

/**
 * POST /api/payments/create — create a real payment URL for VNPay/MoMo/ZaloPay.
 * Body: { method: 'VNPAY'|'MOMO'|'ZALOPAY', orderCode, amount, orderInfo }
 * Returns: { payUrl } — customer is redirected there to pay for real.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.method || !body?.orderCode || !body?.amount) {
    return NextResponse.json({ success: false, error: 'Thiếu method, orderCode hoặc amount' }, { status: 400 })
  }

  const method = String(body.method).toUpperCase()
  const orderCode = String(body.orderCode)
  const amount = Number(body.amount)
  const orderInfo = `Thanh toan don ${orderCode} - Noi That AVH`
  const ipAddr = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  let payUrl: string | null = null

  if (method === 'VNPAY') {
    payUrl = createVnPayUrl({
      orderId: orderCode,
      amount,
      orderInfo,
      returnUrl: `${baseUrl}/?view=order-success&orderCode=${orderCode}`,
      ipAddr,
    })
  } else if (method === 'MOMO') {
    const result = await createMoMoPayment({
      orderId: orderCode,
      amount,
      orderInfo,
      returnUrl: `${baseUrl}/?view=order-success&orderCode=${orderCode}`,
      webhookUrl: `${baseUrl}/api/payments/momo/webhook`,
    })
    payUrl = result?.payUrl || null
  } else if (method === 'ZALOPAY') {
    const result = await createZaloPayPayment({
      orderId: orderCode,
      amount,
      orderInfo,
      returnUrl: `${baseUrl}/?view=order-success&orderCode=${orderCode}`,
      webhookUrl: `${baseUrl}/api/payments/zalopay/webhook`,
    })
    payUrl = result?.orderUrl || null
  }

  if (!payUrl) {
    return NextResponse.json({
      success: false,
      error: `Chưa cấu hình ${method}. Thêm ${method}_* credentials vào .env.`,
    }, { status: 400 })
  }

  return NextResponse.json({ success: true, data: { payUrl } })
}

import { NextRequest, NextResponse } from 'next/server'
import { processWebhook } from '@/lib/payments/process-webhook'
import { logWarn } from '@/lib/system-log'

/**
 * POST /api/orders/[code]/pay — INTERNAL webhook endpoint (BANK transfer / generic).
 *
 * ⚠️ NOT callable from the browser. Requires `x-webhook-secret` header matching
 * PAYMENT_WEBHOOK_SECRET (or NEXTAUTH_SECRET as fallback). Use this for bank
 * transfer webhooks (e.g. VietQR transaction API, Cassopay) or for a generic
 * server-to-server confirmation flow.
 *
 * Body: { txnRef, amount, status }
 *   - txnRef: the provider's transaction id (stored on PaymentSession for idempotency)
 *   - amount: must EXACTLY match the session's amount snapshot
 *   - status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED' (default SUCCESS)
 *
 * This endpoint delegates to the unified `processWebhook` so it shares the same
 * idempotency, amount-verification, DB-transaction, and audit-trail behavior
 * as the VNPAY / MOMO / ZALOPAY routes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  // ── Webhook secret check (block browser calls) ──────────────────────
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET
  const provided = req.headers.get('x-webhook-secret')
  if (!secret || provided !== secret) {
    await logWarn('payment', 'Internal webhook: x-webhook-secret không hợp lệ', JSON.stringify({ code: (await params).code }))
    return NextResponse.json(
      { success: false, error: 'Unauthorized: webhook secret không hợp lệ' },
      { status: 403 }
    )
  }

  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const txnRef = (body.txnRef as string) || 'TXN-' + Date.now().toString(36).toUpperCase()
  const amount = Number(body.amount)
  const status = (body.status as 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED') || 'SUCCESS'

  // Hand off to the unified processor. payment_reference = order code (BANK).
  const result = await processWebhook({
    provider: 'BANK',
    paymentReference: code.toUpperCase(),
    providerTransactionId: txnRef,
    amount,
    status,
    rawPayload: body,
  })

  if (result.ok) {
    return NextResponse.json({
      success: true,
      data: { code, txnRef, result: result.code, message: result.message },
    })
  }
  // Idempotent "already confirmed" → 200 (so the caller stops retrying)
  if (result.code === 'ALREADY') {
    return NextResponse.json({ success: true, data: { alreadyPaid: true, message: result.message } })
  }
  // Everything else → 4xx (caller may retry if transient)
  const status_code = result.code === 'NOT_FOUND' ? 404
    : result.code === 'EXPIRED' ? 410
    : result.code === 'AMOUNT_MISMATCH' || result.code === 'ALREADY_PAID_DIFFERENT' ? 409
    : 400
  return NextResponse.json({ success: false, error: result.message, code: result.code }, { status: status_code })
}

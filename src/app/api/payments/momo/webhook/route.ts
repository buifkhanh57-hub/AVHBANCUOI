import { NextRequest, NextResponse } from 'next/server'
import { verifyMoMoCallback } from '@/lib/payments/momo'
import { processWebhook } from '@/lib/payments/process-webhook'
import { logWarn } from '@/lib/system-log'

/**
 * POST /api/payments/momo/webhook — MoMo IPN (Instant Payment Notification).
 *
 * MoMo calls this server-to-server after the customer pays. Flow:
 *   1. MoMo signs the JSON body with HMAC-SHA256 using MOMO_SECRET_KEY.
 *   2. We verify the signature (rejects forged callbacks).
 *   3. We extract { payment_reference, provider_transaction_id, amount, status }
 *      and pass them to the unified `processWebhook`.
 *   4. We respond with MoMo's expected format: { code, message }.
 *
 * RESPONSE CODES (per MoMo's IPN spec):
 *   code=0  — received + processed (success OR already confirmed — idempotent)
 *   code=99 — signature invalid / amount mismatch / internal error
 *   code=1  — order not found
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ code: 99, message: 'No body' })

  // 1. Verify HMAC-SHA256 signature.
  if (!verifyMoMoCallback(body)) {
    await logWarn('payment', 'MoMo webhook: HMAC-SHA256 signature không hợp lệ', JSON.stringify({ orderId: body['orderId'] }))
    return NextResponse.json({ code: 99, message: 'Invalid signature' })
  }

  // 2. Extract normalized fields.
  const resultCode = body['resultCode']
  const orderCode = body['orderId'] || ''
  const providerTransactionId = body['transId']?.toString() || body['requestId'] || orderCode
  const amount = Number(body['amount'] || 0)
  // MoMo resultCode: 0 = success, anything else = failed (see MoMo docs).
  const status = resultCode === 0 ? 'SUCCESS' : 'FAILED'

  // 3. Hand off to the unified processor.
  const result = await processWebhook({
    provider: 'MOMO',
    paymentReference: orderCode,
    providerTransactionId,
    amount,
    status: status as 'SUCCESS' | 'FAILED',
    rawPayload: body,
  })

  // 4. Map to MoMo's response format.
  if (result.ok) return NextResponse.json({ code: 0, message: result.message })
  if (result.code === 'NOT_FOUND') return NextResponse.json({ code: 1, message: 'Order not found' })
  // AMOUNT_MISMATCH / EXPIRED / ALREADY_PAID_DIFFERENT / ERROR → 99
  return NextResponse.json({ code: 99, message: result.message })
}

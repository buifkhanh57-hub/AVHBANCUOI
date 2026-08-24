import { NextRequest, NextResponse } from 'next/server'
import { verifyZaloPayCallback } from '@/lib/payments/zalopay'
import { processWebhook } from '@/lib/payments/process-webhook'
import { logWarn } from '@/lib/system-log'

/**
 * POST /api/payments/zalopay/webhook — ZaloPay callback.
 *
 * ZaloPay calls this server-to-server after the customer pays. Flow:
 *   1. ZaloPay signs the JSON body with HMAC-SHA256 using ZALOPAY_KEY2.
 *   2. We verify the mac (rejects forged callbacks).
 *   3. We extract { payment_reference, provider_transaction_id, amount, status }
 *      and pass them to the unified `processWebhook`.
 *   4. We respond with ZaloPay's expected format: { return_code, return_message }.
 *
 * RESPONSE CODES (per ZaloPay's callback spec):
 *   return_code=1  — processed successfully (or already confirmed — idempotent)
 *   return_code=0  — signature invalid / order not found / amount mismatch
 *   return_code=2  — order already confirmed (legacy — we now use 1 idempotent)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ return_code: 0, return_message: 'No body' })

  // 1. Verify HMAC-SHA256 mac.
  if (!verifyZaloPayCallback(body)) {
    await logWarn('payment', 'ZaloPay webhook: mac không hợp lệ', JSON.stringify({ app_trans_id: body['app_trans_id'] }))
    return NextResponse.json({ return_code: 0, return_message: 'Invalid mac' })
  }

  // 2. Extract normalized fields. ZaloPay's app_trans_id is `<timestamp>_<ORDER_CODE>`.
  const appTransId = body['app_trans_id'] || ''
  const orderCode = appTransId.includes('_') ? appTransId.split('_').slice(1).join('_') : appTransId
  const providerTransactionId = body['zp_trans_id']?.toString() || appTransId
  const amount = Number(body['amount'] || 0)
  // ZaloPay status: 1 = success. Anything else = failed.
  const status = Number(body['status']) === 1 ? 'SUCCESS' : 'FAILED'

  // 3. Hand off to the unified processor.
  const result = await processWebhook({
    provider: 'ZALOPAY',
    paymentReference: orderCode,
    providerTransactionId,
    amount,
    status: status as 'SUCCESS' | 'FAILED',
    rawPayload: body,
  })

  // 4. Map to ZaloPay's response format.
  if (result.ok) return NextResponse.json({ return_code: 1, return_message: result.message })
  if (result.code === 'NOT_FOUND') return NextResponse.json({ return_code: 0, return_message: 'Order not found' })
  return NextResponse.json({ return_code: 0, return_message: result.message })
}

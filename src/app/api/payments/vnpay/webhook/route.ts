import { NextRequest, NextResponse } from 'next/server'
import { verifyVnPayCallback, parseOrderCode } from '@/lib/payments/vnpay'
import { processWebhook } from '@/lib/payments/process-webhook'
import { logWarn } from '@/lib/system-log'

/**
 * GET /api/payments/vnpay/webhook — VNPay IPN (Instant Payment Notification).
 *
 * VNPay calls this server-to-server after the customer pays. Flow:
 *   1. VNPay signs the callback params with HMAC-SHA512 using VNP_HASH_SECRET.
 *   2. We verify the signature (rejects forged callbacks).
 *   3. We extract { payment_reference, provider_transaction_id, amount, status }
 *      and pass them to the unified `processWebhook` which:
 *        - finds the PaymentSession by payment_reference
 *        - verifies the amount matches the session snapshot (anti-scam)
 *        - flips the order to PAID inside ONE DB transaction
 *        - stores the raw payload + provider_transaction_id (idempotency)
 *   4. We respond with VNPay's expected format: { RspCode, Message }.
 *
 * RESPONSE CODES (per VNPay's IPN spec):
 *   RspCode=00 — success (payment confirmed OR already confirmed — idempotent)
 *   RspCode=97 — invalid signature (forged webhook, reject)
 *   RspCode=01 — order not found
 *   RspCode=99 — amount mismatch / internal error (admin must investigate)
 */
export async function GET(req: NextRequest) {
  // VNPay sends callback params as URL query string (GET request).
  const params: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => { params[k] = v })

  // 1. Verify HMAC-SHA512 signature. This is the ONLY trust anchor — without
  //    it, anyone could call this endpoint and fake a payment confirmation.
  if (!verifyVnPayCallback(params)) {
    await logWarn('payment', 'VNPay webhook: HMAC-SHA512 signature không hợp lệ (có thể giả mạo)', JSON.stringify({ txnRef: params['vnp_TxnRef'] }))
    return NextResponse.json({ RspCode: '97', Message: 'Invalid signature' })
  }

  // 2. Extract normalized fields. VNPay amounts are in cents (×100).
  const responseCode = params['vnp_ResponseCode']
  const txnRef = params['vnp_TxnRef'] || ''
  const paymentReference = parseOrderCode(txnRef) // back to AVH-XXXXXX
  const providerTransactionId = params['vnp_TransactionNo'] || txnRef // bank-side txn id
  const amount = Number(params['vnp_Amount'] || 0) / 100
  const status = responseCode === '00' ? 'SUCCESS' : 'FAILED'

  // 3. Hand off to the unified processor (idempotency, amount check, tx).
  const result = await processWebhook({
    provider: 'VNPAY',
    paymentReference,
    providerTransactionId,
    amount,
    status: status as 'SUCCESS' | 'FAILED',
    rawPayload: params,
  })

  // 4. Map to VNPay's response format. ALWAYS return 00 for "already paid"
  //    — VNPay retries and we don't want it to keep retrying forever.
  if (result.ok) {
    return NextResponse.json({ RspCode: '00', Message: result.message })
  }
  if (result.code === 'NOT_FOUND') return NextResponse.json({ RspCode: '01', Message: 'Order not found' })
  if (result.code === 'AMOUNT_MISMATCH' || result.code === 'ERROR') return NextResponse.json({ RspCode: '99', Message: result.message })
  if (result.code === 'EXPIRED' || result.code === 'ALREADY_PAID_DIFFERENT') return NextResponse.json({ RspCode: '99', Message: result.message })
  // ALREADY / INVALID / etc → 00 (don't trigger VNPay retries)
  return NextResponse.json({ RspCode: '00', Message: result.message })
}

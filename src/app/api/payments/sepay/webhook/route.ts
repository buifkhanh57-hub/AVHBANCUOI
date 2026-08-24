import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processWebhook } from '@/lib/payments/process-webhook'
import { FIXED_BANK_ACCOUNT, isFixedBankAccount } from '@/lib/fixed-bank-account'
import { logInfo, logWarn, logError } from '@/lib/system-log'

/**
 * POST /api/payments/sepay/webhook — Sepay bank-transfer webhook.
 *
 * AUTHENTICATION:
 *   Sepay signs the raw request body with HMAC-SHA256 using the
 *   `SEPAY_WEBHOOK_SECRET` configured in the Sepay dashboard. The hex
 *   signature is sent in the `X-SePay-Signature` header. We:
 *     1. Read the raw request body (NOT pre-parsed JSON — signature is over
 *        the exact bytes sent).
 *     2. Compute HMAC-SHA256(rawBody, SEPAY_WEBHOOK_SECRET).
 *     3. Compare with the header using `crypto.timingSafeEqual` (constant-time
 *        comparison — prevents timing side-channel attacks).
 *     4. If the signature is missing or doesn't match → 401 Unauthorized.
 *
 * No `?secret=...` query param. No API token exposed to the client. The
 * webhook secret is read from `process.env.SEPAY_WEBHOOK_SECRET` at runtime
 * and never logged.
 *
 * RESPONSE FORMAT (SePay requires `success: true` at the root, NOT nested
 * inside a `data` wrapper — otherwise SePay dashboard reports
 * "Response không đúng quy cách"):
 *   200 OK    → { "success": true, "code": "OK",         "message": "...", "orderCode": "AVH123456" }
 *   200 ALREADY→ { "success": true, "code": "ALREADY",    "message": "...", "orderCode": "AVH123456" }   (idempotent replay)
 *   200 SKIP   → { "success": true, "code": "SKIPPED",   "message": "...", "reason": "..." }
 *   401        → { "success": false, "code": "UNAUTHORIZED", "message": "Invalid signature" }
 *   404        → { "success": false, "code": "NOT_FOUND",  "message": "Order not found", "orderCode": "..." }
 *   409        → { "success": false, "code": "AMOUNT_MISMATCH", "message": "...", "orderCode": "..." }
 *   410        → { "success": false, "code": "EXPIRED",    "message": "...", "orderCode": "..." }
 *   400/500    → { "success": false, "code": "...", "message": "..." }
 *
 * WEBHOOK URL (configured in Sepay dashboard):
 *   https://preview-chat-8c74607f-f594-4cec-9388-a95629b6487a.space-z.ai/api/payments/sepay/webhook
 *   Header to send: X-SePay-Signature: <hex HMAC-SHA256(rawBody, SECRET)>
 */
export async function POST(req: NextRequest) {
  // ── 1. Read the raw request body ────────────────────────────────────
  // `req.text()` gives us the EXACT bytes that Sepay signed. We must NOT
  // call `req.json()` first — that would consume the body and we'd have
  // no raw bytes to verify against.
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json(
      { success: false, code: 'INVALID', message: 'Cannot read request body' },
      { status: 400 }
    )
  }
  if (!rawBody) {
    return NextResponse.json(
      { success: false, code: 'INVALID', message: 'Empty body' },
      { status: 400 }
    )
  }

  // ── 2. Read the HMAC secret + signature header ──────────────────────
  const secret = process.env.SEPAY_WEBHOOK_SECRET
  if (!secret) {
    await logError('payment', 'Sepay webhook: SEPAY_WEBHOOK_SECRET chưa cấu hình trong .env')
    return NextResponse.json(
      { success: false, code: 'CONFIG_ERROR', message: 'Server chưa cấu hình SEPAY_WEBHOOK_SECRET' },
      { status: 500 }
    )
  }

  // Capture request metadata for debug logging (NO secret values).
  const contentLengthHeader = req.headers.get('content-length') || '(none)'
  const sepayTimestamp = req.headers.get('x-sepay-timestamp') || '(none)'

  // Sepay uses X-SePay-Signature (case-insensitive — Next.js lowercases).
  // Some Sepay configs send the signature with a "sha256=" prefix
  // (e.g. "sha256=abc123..."), following the GitHub-style header format.
  // Strip the prefix so we compare the raw hex.
  let providedSig = req.headers.get('x-sepay-signature') || req.headers.get('x-sepay-sign') || ''
  // Strip "sha256=" prefix (case-insensitive) if present.
  if (providedSig.toLowerCase().startsWith('sha256=')) {
    providedSig = providedSig.slice('sha256='.length)
  }
  // Also strip surrounding quotes/whitespace just in case.
  providedSig = providedSig.trim().replace(/^["']|["']$/g, '')

  if (!providedSig) {
    await logWarn('payment', 'Sepay webhook: thiếu header X-SePay-Signature', JSON.stringify({
      contentLengthHeader,
      sepayTimestamp,
      rawBodyLength: rawBody.length,
    }))
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Missing X-SePay-Signature header' },
      { status: 401 }
    )
  }

  // ── 3. Compute expected HMAC-SHA256 + constant-time compare ──────────
  // CRITICAL: HMAC is computed over the EXACT raw body bytes received from
  // the network (req.text()). We NEVER JSON.parse+stringify before verify —
  // doing so would change whitespace/field order and break the signature.
  //
  // SEPAY SIGNING SCHEME (discovered via debug log analysis 2026-08-23):
  //   SePay signs the request using a Slack-style scheme:
  //     signedPayload = "<X-SePay-Timestamp>.<rawBody>"
  //     expected = HMAC-SHA256(signedPayload, SEPAY_WEBHOOK_SECRET)
  //   The "." (period) between timestamp and raw body is the separator.
  //
  //   Verified by computing HMAC of the exact raw body SePay sent (logged
  //   in SystemLog on previous failed attempt) with various combinations
  //   of timestamp + body. Only "<ts>.<body>" matched SePay's signature.
  //
  // FALLBACK: If X-SePay-Timestamp is missing (older SePay config or test
  // tools), we fall back to signing raw body only — keeps backward compat
  // with our own curl tests that don't send timestamp.
  const sepayTimestampRaw = req.headers.get('x-sepay-timestamp') || ''
  const signedPayload = sepayTimestampRaw
    ? `${sepayTimestampRaw}.${rawBody}`
    : rawBody
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  // For debug fingerprinting: SHA256 of raw body (NOT HMAC, just a hash so
  // we can confirm the raw body byte content without exposing the secret).
  const rawBodySha256 = crypto
    .createHash('sha256')
    .update(rawBody, 'utf8')
    .digest('hex')

  // timingSafeEqual requires equal-length buffers; we check length first to
  // avoid throwing on mismatched lengths (which would be a signature error
  // anyway).
  const providedBuf = Buffer.from(providedSig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  let signatureValid = providedBuf.length === expectedBuf.length
  if (signatureValid) {
    try {
      signatureValid = crypto.timingSafeEqual(providedBuf, expectedBuf)
    } catch {
      signatureValid = false
    }
  }
  if (!signatureValid) {
    // DEBUG LOG — safe fields only, NO secret value logged.
    await logWarn('payment', 'Sepay webhook: HMAC-SHA256 signature không hợp lệ', JSON.stringify({
      // Request metadata
      contentLengthHeader,
      sepayTimestamp,
      // Signing scheme info
      signingScheme: sepayTimestampRaw ? '<timestamp>.<rawBody>' : '<rawBody> (no timestamp)',
      // Raw body info (fingerprint without exposing content fully)
      rawBodyLength: rawBody.length,
      rawBodySha256,           // SHA256(rawBody) — lets us compare raw body across requests
      rawBodyPreview: rawBody.slice(0, 500),  // first 500 chars for inspection
      // Signature info (truncated to avoid leaking full sig in logs)
      computedHmacPreview: expectedSig.slice(0, 32) + '...',
      receivedHmacPreview: providedSig.slice(0, 32) + '...',
      computedHmacLen: expectedSig.length,
      receivedHmacLen: providedSig.length,
      // Secret info (length only — NEVER log the secret value)
      secretLength: secret.length,
      // Result
      signatureValid: false,
    }, null, 2))
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Invalid signature' },
      { status: 401 }
    )
  }

  // ── 4. Parse the JSON payload (signature already verified) ──────────
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    await logWarn('payment', 'Sepay webhook: body không phải JSON hợp lệ')
    return NextResponse.json(
      { success: false, code: 'INVALID', message: 'Invalid JSON' },
      { status: 400 }
    )
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { success: false, code: 'INVALID', message: 'Empty payload' },
      { status: 400 }
    )
  }

  // ── 5. Extract normalized fields from Sepay payload ─────────────────
  // Sepay's REAL webhook payload uses camelCase fields:
  //   - gateway                 : bank name (e.g. "VPBank", "MB Bank")
  //   - transactionDate          : ISO timestamp string
  //   - accountNumber            : receiver's bank account (digits string)
  //   - subAccount               : sub-account (usually "")
  //   - code                     : the order code (AVH123456) — Sepay extracts it for us
  //   - content                  : customer's transfer note (also contains the code)
  //   - transferType             : "in" | "out"
  //   - description              : human-readable description (also has the code)
  //   - transferAmount           : VND amount (NUMBER, not string)
  //   - referenceCode            : Sepay's reference code
  //   - accumulated              : running balance (ignore)
  //   - id                       : Sepay event id (numeric)
  // We support BOTH the real format AND the documented format (snake_case
  // string amounts) so the same endpoint works for production Sepay + tests.
  const txnId = String(body['id'] || body['referenceCode'] || body['transaction_id'] || '')
  // transferAmount is a NUMBER in real payload; transaction_amount_in is a STRING in docs.
  const amountIn = Number(body['transferAmount'] || body['transaction_amount_in'] || 0)
  const amountOut = Number(body['transaction_amount_out'] || 0)
  // transferType: "in" / "out" — only present in real payload.
  const transferType = String(body['transferType'] || body['transaction_type'] || '').toLowerCase()
  // Sepay sends the order code directly in `code` field — prefer that over
  // regex extraction (more reliable, matches Sepay's own parsing).
  const codeFromField = String(body['code'] || body['orderCode'] || '').toUpperCase()
  const content = String(body['content'] || body['transaction_content'] || body['description'] || '')
  const customerName = String(body['customer_name'] || body['customerName'] || body['customer_account_name'] || '')
  const customerAccount = String(body['customer_account_number'] || body['customerAccountNumber'] || '')
  // Receiver's account — Sepay calls it `accountNumber` (camelCase).
  const ourAccount = String(body['accountNumber'] || body['account_number'] || '')
  const gateway = String(body['gateway'] || body['bank_abbrev'] || '')

  if (!txnId) {
    await logWarn('payment', 'Sepay webhook: thiếu id (Sepay event id)')
    return NextResponse.json(
      { success: false, code: 'INVALID', message: 'Thiếu transaction id' },
      { status: 400 }
    )
  }

  // Only IN transactions count as payments.
  // Real payload has `transferType: "in"`. If absent, fall back to checking
  // the amount fields (legacy docs format).
  const isIncoming = transferType === 'in' || (transferType === '' && amountIn > 0 && amountOut === 0)
  if (!isIncoming || amountIn <= 0) {
    await logInfo('payment', 'Sepay webhook: bỏ qua giao dịch OUT / amount 0', JSON.stringify({ txnId, transferType, amountIn, amountOut }))
    return NextResponse.json(
      { success: true, code: 'SKIPPED', message: 'Not an incoming transaction', reason: transferType || 'no_amount' },
      { status: 200 }
    )
  }

  // ── 5.5. Verify destination account matches the FIXED bank account ────
  // The merchant requires ALL payments go to a single hardcoded account
  // (see src/lib/fixed-bank-account.ts). If Sepay reports a transaction to a
  // DIFFERENT account (e.g. a typo in the bank dashboard, or someone linked
  // the wrong account), we MUST reject it — otherwise money could land in an
  // unmonitored account while still being marked PAID in our system.
  //
  // RESPONSE STRATEGY: We return HTTP 200 + `success:true` + code
  // BANK_ACCOUNT_MISMATCH. The order is NOT marked PAID (we don't call
  // processWebhook). Sepay sees success:true → stops retrying → no spam.
  // The mismatch is logged + visible in the admin Logs tab for follow-up.
  // This is the pragmatic compromise: SePay strictly requires success:true
  // in the response body, otherwise it reports "Body thiếu success:true"
  // and keeps retrying forever. Returning 200 + success:true + a clear code
  // keeps Sepay's UI happy while still rejecting the payment.
  if (!isFixedBankAccount({ accountNumber: ourAccount, gateway, bankCode: gateway })) {
    await logWarn('payment', 'Sepay webhook: BANK_ACCOUNT_MISMATCH — tiền vào sai tài khoản, không xác nhận payment', JSON.stringify({
      receivedAccount: ourAccount,
      receivedGateway: gateway,
      expectedAccount: FIXED_BANK_ACCOUNT.accountNumber,
      txnId,
      amountIn,
      orderCode: codeFromField || '(none)',
    }))
    return NextResponse.json(
      {
        success: true,
        code: 'BANK_ACCOUNT_MISMATCH',
        message: `Tiền vào tài khoản ${ourAccount || '(empty)'} không đúng tài khoản cố định ${FIXED_BANK_ACCOUNT.accountNumber}. Payment KHÔNG được xác nhận — đơn vẫn PENDING.`,
        receivedAccount: ourAccount,
        receivedGateway: gateway,
        expectedAccount: FIXED_BANK_ACCOUNT.accountNumber,
        orderCode: codeFromField || undefined,
      },
      { status: 200 }
    )
  }

  // ── 6. Extract order code (payment_reference) ─────────────────────────
  // Prefer the `code` field that Sepay already parsed for us. Fall back to
  // regex extraction from `content` / `description` if Sepay didn't fill it.
  // Format: AVH + 6 digits (e.g. AVH940089) — matches Sepay's regex
  // ^AVH[0-9]{6,8}$.
  let orderCode = codeFromField
  if (!orderCode) {
    const match = content.match(/AVH[0-9]{6,8}/i)
    if (match) orderCode = match[0].toUpperCase()
  }
  if (!orderCode) {
    await logWarn('payment', 'Sepay webhook: không tìm thấy mã đơn trong payload', JSON.stringify({ code: codeFromField, content: content.slice(0, 200), txnId, amountIn, customerAccount }))
    // Return 200 + success:true so Sepay doesn't retry forever on transactions
    // that don't belong to us (e.g. customer paid someone else by mistake).
    return NextResponse.json(
      { success: true, code: 'SKIPPED', message: 'No order code in payload', reason: 'no_match' },
      { status: 200 }
    )
  }

  // ── 7. Hand off to the unified processor ─────────────────────────────
  // processWebhook does:
  //   - find PaymentSession by paymentReference = orderCode
  //   - check expires_at
  //   - verify amountIn === session.amount (EXACT match — anti-scam)
  //   - check idempotency (providerTransactionId unique constraint)
  //   - atomic $transaction: PENDING → PAID + SUCCESS
  //   - store rawPayload (sanitized of secrets)
  //   - timeline entry + user notification
  const result = await processWebhook({
    provider: 'BANK',
    paymentReference: orderCode,
    providerTransactionId: `SEPAY-${txnId}`,
    amount: amountIn,
    status: 'SUCCESS',
    rawPayload: body,
  })

  // ── 8. Map result → HTTP response (FLAT — no `data` wrapper) ─────────
  // SePay requires `success: true` at the root for a successful webhook.
  // Idempotent replays also return 200 + success:true so SePay stops retrying.
  if (result.ok) {
    await logInfo('payment', `Sepay webhook: đơn ${orderCode} → ${result.code}`, JSON.stringify({ txnId: `SEPAY-${txnId}`, amount: amountIn, customer: customerName, account: ourAccount }))
    return NextResponse.json(
      {
        success: true,
        code: result.code, // 'OK' or 'ALREADY'
        message: result.message,
        orderCode,
      },
      { status: 200 }
    )
  }

  // Error cases — return appropriate HTTP status so Sepay knows whether to
  // retry (4xx = don't retry, 5xx = retry).
  if (result.code === 'NOT_FOUND') {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: 'Order not found', orderCode },
      { status: 404 }
    )
  }
  if (result.code === 'EXPIRED') {
    return NextResponse.json(
      { success: false, code: 'EXPIRED', message: 'Payment session expired', orderCode },
      { status: 410 }
    )
  }
  if (result.code === 'AMOUNT_MISMATCH' || result.code === 'ALREADY_PAID_DIFFERENT') {
    await logWarn('payment', `Sepay ${result.code}`, JSON.stringify({ orderCode, expectedAmount: amountIn, txnId }))
    return NextResponse.json(
      { success: false, code: result.code, message: result.message, orderCode },
      { status: 409 }
    )
  }
  // INVALID / ERROR → 400
  return NextResponse.json(
    { success: false, code: result.code, message: result.message },
    { status: 400 }
  )
}

// GET handler — Sepay docs say they POST, but some clients test with GET first.
// Reject GET clearly so misconfigurations surface fast.
export async function GET() {
  return NextResponse.json(
    { success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method GET not allowed. Sepay must send POST with X-SePay-Signature header.' },
    { status: 405 }
  )
}

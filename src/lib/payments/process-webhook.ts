// Unified webhook processor — single source of truth for verifying and
// applying a payment-gateway callback to an order.
//
// INVARIANTS enforced here (per the payment-refactor audit):
//   1. The customer's browser can NEVER mark an order as paid. Only a
//      provider-signed webhook can — verified by HMAC (see callers).
//   2. The amount reported by the provider must EXACTLY match the
//      PaymentSession's snapshot amount. Mismatch → reject (anti-scam).
//   3. A single provider transaction can only be processed ONCE. The unique
//      constraint on PaymentSession.providerTransactionId makes the second
//      attempt fail at the DB level — true idempotency, not just a soft
//      pre-check.
//   4. The full transition `pending → paid` happens inside ONE Prisma
//      `$transaction` so partial updates are impossible.
//   5. The raw payload is stored for audit / reconciliation.
//   6. Secrets are NEVER logged — only the providerTransactionId (which is
//      already a public reference) and the result.
//
// CALLERS (provider-specific webhook routes) are responsible for:
//   - Verifying the provider's HMAC signature (provider-specific algorithm).
//   - Parsing the provider's payload into the normalized `WebhookInput`.
//   - Returning the provider-specific response format (e.g. VNPay expects
//     { RspCode, Message }, MoMo expects { code, message }, etc.).

import { db } from '@/lib/db'
import { logInfo, logWarn, logError } from '@/lib/system-log'
import { timelineEntry } from '@/lib/format'

export type PaymentProvider = 'VNPAY' | 'MOMO' | 'ZALOPAY' | 'BANK'
export type PaymentEventStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED' | 'PENDING'

export interface WebhookInput {
  provider: PaymentProvider
  // Reference identifying WHICH payment session this is. For BANK this is the
  // order code (AVH-XXXXXX) itself; for VNPAY/MOMO/ZALOPAY it's the txnRef /
  // requestId / app_trans_id the provider echoes back.
  paymentReference: string
  // The provider's transaction id — unique per transaction. Stored as
  // PaymentSession.providerTransactionId (unique constraint → idempotency).
  providerTransactionId: string
  // Amount in VND, as reported by the provider. Must match session.amount.
  amount: number
  status: PaymentEventStatus
  // The full raw payload (sanitized of secrets by the caller) for audit.
  rawPayload: unknown
}

export interface WebhookResult {
  ok: boolean
  // Provider-agnostic result code — caller maps to provider-specific format.
  // 'OK'         — payment successfully verified, order flipped to PAID.
  // 'ALREADY'    — session already SUCCESS, idempotent no-op.
  // 'NOT_FOUND'  — no PaymentSession matches payment_reference.
  // 'EXPIRED'    — session expired before webhook arrived.
  // 'AMOUNT_MISMATCH' — provider amount ≠ session.amount (potential scam).
  // 'ALREADY_PAID_DIFFERENT' — order already PAID by a different session.
  // 'INVALID'    — invalid input (missing fields, etc.).
  // 'ERROR'      — unexpected internal error.
  code:
    | 'OK'
    | 'ALREADY'
    | 'NOT_FOUND'
    | 'EXPIRED'
    | 'AMOUNT_MISMATCH'
    | 'ALREADY_PAID_DIFFERENT'
    | 'INVALID'
    | 'ERROR'
  message: string
}

/**
 * Process a verified provider webhook — verify the payment, then atomically
 * flip the order to PAID. Safe to call from any provider route (VNPAY/MOMO/
 * ZALOPAY/BANK). Idempotent: replays for the same providerTransactionId are
 * rejected by the DB unique constraint.
 */
export async function processWebhook(input: WebhookInput): Promise<WebhookResult> {
  const { provider, paymentReference, providerTransactionId, amount, status, rawPayload } = input

  // ── Validate input ────────────────────────────────────────────────────
  if (!paymentReference || !providerTransactionId || !provider) {
    await logWarn('payment', `Webhook rejected: missing required field`, JSON.stringify({ provider, paymentReference, providerTransactionId }))
    return { ok: false, code: 'INVALID', message: 'Missing required field' }
  }
  if (!Number.isFinite(amount) || amount < 0) {
    await logWarn('payment', `Webhook rejected: invalid amount`, JSON.stringify({ provider, paymentReference, amount }))
    return { ok: false, code: 'INVALID', message: 'Invalid amount' }
  }

  // Sanitize raw payload before storing — strip anything that looks like a
  // secret (we trust the caller to already remove HMAC, but double-check).
  const sanitizedPayload = sanitizePayload(rawPayload)

  // ── Find the payment session by reference ─────────────────────────────
  const session = await db.paymentSession.findUnique({ where: { paymentReference } })
  if (!session) {
    await logWarn('payment', `Webhook: payment_reference not found`, JSON.stringify({ provider, paymentReference, providerTransactionId }))
    return { ok: false, code: 'NOT_FOUND', message: 'Payment session not found' }
  }

  // ── Idempotency check #1: session already settled ─────────────────────
  if (session.status === 'SUCCESS') {
    await logInfo('payment', `Webhook idempotent skip: session ${paymentReference} already SUCCESS`, JSON.stringify({ providerTransactionId }))
    return { ok: true, code: 'ALREADY', message: 'Already confirmed' }
  }

  // ── Idempotency check #2: providerTransactionId already used by another
  // session (replay against a different session — definitely a bug/scam).
  const existingTxn = await db.paymentSession.findUnique({ where: { providerTransactionId } })
  if (existingTxn && existingTxn.id !== session.id) {
    await logWarn('payment', `Webhook REJECTED: providerTransactionId already used by another session`, JSON.stringify({ providerTransactionId, thisSession: paymentReference, otherSession: existingTxn.paymentReference }))
    return { ok: false, code: 'ALREADY_PAID_DIFFERENT', message: 'Transaction already applied to a different session' }
  }

  // ── Expiry check ───────────────────────────────────────────────────────
  if (session.expiresAt && new Date() > session.expiresAt) {
    await logWarn('payment', `Webhook rejected: session expired`, JSON.stringify({ paymentReference, expiresAt: session.expiresAt }))
    return { ok: false, code: 'EXPIRED', message: 'Payment session expired' }
  }

  // ── Amount verification (anti-scam) ───────────────────────────────────
  if (amount !== session.amount) {
    await logWarn('payment', `Webhook AMOUNT MISMATCH — possible scam attempt`, JSON.stringify({ paymentReference, expected: session.amount, received: amount, providerTransactionId }))
    // Mark session FAILED so it can't be retried with the same reference.
    await db.paymentSession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED',
        rawPayload: sanitizedPayload,
        providerTransactionId,
      },
    })
    return { ok: false, code: 'AMOUNT_MISMATCH', message: `Amount ${amount} does not match expected ${session.amount}` }
  }

  // ── Handle non-SUCCESS events (FAILED/CANCELLED/REFUNDED) ─────────────
  if (status !== 'SUCCESS') {
    await db.$transaction(async (tx) => {
      await tx.paymentSession.update({
        where: { id: session.id },
        data: {
          status: status === 'FAILED' ? 'FAILED' : status === 'CANCELLED' ? 'CANCELLED' : status === 'REFUNDED' ? 'REFUNDED' : 'FAILED',
          rawPayload: sanitizedPayload,
          providerTransactionId,
          verifiedAt: new Date(),
        },
      })
      const order = await tx.order.findUnique({ where: { id: session.orderId } })
      if (order) {
        const timeline = JSON.parse(order.timeline || '[]')
        timeline.push(timelineEntry('PAYMENT_EVENT', `${provider} webhook: status=${status}, txn=${providerTransactionId}`))
        await tx.order.update({
          where: { id: order.id },
          data: { timeline: JSON.stringify(timeline) },
        })
      }
    })
    await logInfo('payment', `${provider} webhook: session ${paymentReference} → ${status}`, JSON.stringify({ providerTransactionId, amount }))
    return { ok: true, code: 'OK', message: `Event ${status} recorded` }
  }

  // ── SUCCESS: atomic transition pending → paid ─────────────────────────
  // The whole transition happens inside ONE Prisma transaction. If any step
  // fails (e.g. unique constraint on providerTransactionId due to a race),
  // the entire transaction rolls back — order is NOT marked paid, session is
  // NOT marked SUCCESS, no notification is created.
  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Update PaymentSession — this is where the unique constraint on
      //    providerTransactionId protects against concurrent webhooks: if
      //    two webhooks race, only one succeeds here, the other throws
      //    P2002 (unique constraint) → rolls back → caller returns 409.
      const updated = await tx.paymentSession.update({
        where: { id: session.id },
        data: {
          status: 'SUCCESS',
          providerTransactionId,
          rawPayload: sanitizedPayload,
          verifiedAt: new Date(),
        },
      })

      // 2. Re-fetch the order inside the tx — don't trust the version from
      //    outside the transaction (could be stale by now).
      const order = await tx.order.findUnique({ where: { id: session.orderId } })
      if (!order) throw new Error(`Order ${session.orderId} not found`)

      // 3. Invariant: order can only be PAID once. If it's already PAID,
      //    this is a different session trying to double-pay the same order.
      if (order.paymentStatus === 'PAID') {
        throw new Error('ALREADY_PAID_DIFFERENT')
      }

      // 4. Update order → PAID + PROCESSING.
      const timeline = JSON.parse(order.timeline || '[]')
      timeline.push(timelineEntry('PAYMENT_CONFIRMED', `${provider} webhook: đã nhận ${amount.toLocaleString('vi-VN')}₫. Mã GD: ${providerTransactionId}`))
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: 'PROCESSING',
          timeline: JSON.stringify(timeline),
        },
      })

      // 5. Update the legacy Payment row (kept for backward compat with
      //    admin panel + existing queries).
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: 'SUCCESS', txnRef: providerTransactionId, paymentSessionId: session.id },
      })

      // 6. Create user notification.
      if (order.userId) {
        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'ORDER',
            title: `Thanh toán thành công — ${order.code}`,
            body: `${provider} đã xác nhận thanh toán ${amount.toLocaleString('vi-VN')}₫. Đơn đang được xử lý.`,
            link: `order-tracking?code=${order.code}`,
          },
        })
      }

      return { session: updated, order: updatedOrder }
    })

    await logInfo('payment', `${provider} webhook: đơn ${result.order.code} đã xác nhận ${amount.toLocaleString('vi-VN')}₫`, JSON.stringify({ paymentReference, providerTransactionId, sessionId: session.id }))
    return { ok: true, code: 'OK', message: 'Confirm success' }
  } catch (err: any) {
    // Prisma unique-constraint violation → concurrent webhook race.
    if (err?.code === 'P2002') {
      await logWarn('payment', `Webhook race detected — providerTransactionId already exists`, JSON.stringify({ providerTransactionId, paymentReference }))
      return { ok: true, code: 'ALREADY', message: 'Already confirmed by a concurrent webhook' }
    }
    if (err?.message === 'ALREADY_PAID_DIFFERENT') {
      await logWarn('payment', `Order already PAID by a different session`, JSON.stringify({ paymentReference, orderId: session.orderId }))
      return { ok: false, code: 'ALREADY_PAID_DIFFERENT', message: 'Order already paid by a different session' }
    }
    await logError('payment', `Webhook internal error`, JSON.stringify({ error: String(err?.message || err), paymentReference, providerTransactionId }))
    return { ok: false, code: 'ERROR', message: 'Internal error' }
  }
}

/**
 * Strip anything that looks like a secret from the payload before storing.
 * We never log/secrets. The list is intentionally conservative — fields with
 * these names are redacted to '[REDACTED]'.
 */
function sanitizePayload(payload: unknown): string {
  if (!payload) return ''
  const SECRET_KEYS = ['secret', 'signature', 'mac', 'secureHash', 'hashSecret', 'accessKey', 'access_key', 'apiKey', 'api_key', 'password', 'token']
  try {
    const json = JSON.parse(JSON.stringify(payload))
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj
      if (Array.isArray(obj)) return obj.map(sanitize)
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        if (SECRET_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
          out[k] = '[REDACTED]'
        } else {
          out[k] = sanitize(v)
        }
      }
      return out
    }
    return JSON.stringify(sanitize(json))
  } catch {
    // Not JSON-serializable — fall back to a stringified version with secrets
    // redacted via regex.
    const str = String(payload)
    return str.replace(/"(?:secret|signature|mac|secureHash|hashSecret|accessKey|apiKey|password|token)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"')
  }
}

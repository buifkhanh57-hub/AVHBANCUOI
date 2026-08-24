// VNPay payment integration — real webhook with HMAC-SHA512 signature.
// Flow: customer → create payment URL → VNPay page → pay → VNPay calls webhook
// → verify signature → auto-confirm order (no manual action, no scam).
//
// REQUIRED .env:
//   VNP_TMN_CODE=your_merchant_code
//   VNP_HASH_SECRET=your_hash_secret
//   VNP_RETURN_URL=https://yourdomain.com/api/payments/vnpay/return
//   VNP_WEBHOOK_URL=https://yourdomain.com/api/payments/vnpay/webhook
//
// Get credentials: https://merchant.vnpay.vn/ (register as merchant)

import crypto from 'crypto'

const VNP_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
const VNP_VERSION = '2.1.0'

/** Create a VNPay payment URL. Customer is redirected here to pay. */
export function createVnPayUrl(opts: {
  orderId: string       // order code (AVH-XXXXXX)
  amount: number         // VND
  orderInfo: string      // description
  returnUrl: string      // where to redirect customer after payment
  ipAddr: string
}): string | null {
  const tmnCode = process.env.VNP_TMN_CODE
  const hashSecret = process.env.VNP_HASH_SECRET
  if (!tmnCode || !hashSecret) return null

  const date = new Date()
  const createDate = formatDate(date)
  const txnRef = opts.orderId.replace(/-/g, '') // VNPay doesn't like hyphens

  const params: Record<string, string> = {
    vnp_Version: VNP_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(opts.amount * 100), // VNPay uses cents
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: opts.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: opts.returnUrl,
    vnp_IpAddr: opts.ipAddr,
    vnp_CreateDate: createDate,
  }

  // Sort + build query string (excluding vnp_SecureHash)
  const sorted = sortObject(params)
  const queryString = new URLSearchParams(sorted).toString()
  const secureHash = hmacSHA512(hashSecret, queryString)
  return `${VNP_PAY_URL}?${queryString}&vnp_SecureHash=${secureHash}`
}

/** Verify VNPay webhook callback signature. Returns true if authentic. */
export function verifyVnPayCallback(params: Record<string, string>): boolean {
  const hashSecret = process.env.VNP_HASH_SECRET
  if (!hashSecret) return false

  const secureHash = params['vnp_SecureHash']
  if (!secureHash) return false

  // Remove vnp_SecureHash + vnp_SecureHashType, sort remaining, build query
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params
  const sorted = sortObject(rest)
  const queryString = new URLSearchParams(sorted).toString()
  const computed = hmacSHA512(hashSecret, queryString)
  return secureHash === computed
}

/**
 * Extract order code from VNPay TxnRef.
 *
 * Order codes are now generated as `AVH` + 6 digits (e.g. AVH123456) to
 * match SePay's regex ^AVH[0-9]{6,8}$. No hyphen insertion anymore — just
 * return the TxnRef as-is. (Legacy AVH-XXXXXX codes were never sent through
 * VNPay anyway, so we don't need to support them here.)
 */
export function parseOrderCode(txnRef: string): string {
  return txnRef
}

function hmacSHA512(key: string, data: string): string {
  return crypto.createHmac('sha512', key).update(data).digest('hex')
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function sortObject(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {}
  Object.keys(obj).sort().forEach((k) => { sorted[k] = obj[k] })
  return sorted
}

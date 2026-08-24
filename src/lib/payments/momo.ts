// MoMo payment integration — real webhook with HMAC-SHA256 signature.
// REQUIRED .env:
//   MOMO_PARTNER_CODE=your_partner_code
//   MOMO_ACCESS_KEY=your_access_key
//   MOMO_SECRET_KEY=your_secret_key
// Get credentials: https://business.momo.vn/

import crypto from 'crypto'

const MOMO_API_URL = 'https://test-payment.momo.vn/v2/gateway/api/create'

/** Create a MoMo payment request. Returns the pay URL. */
export async function createMoMoPayment(opts: {
  orderId: string
  amount: number
  orderInfo: string
  returnUrl: string
  webhookUrl: string
}): Promise<{ payUrl: string } | null> {
  const partnerCode = process.env.MOMO_PARTNER_CODE
  const accessKey = process.env.MOMO_ACCESS_KEY
  const secretKey = process.env.MOMO_SECRET_KEY
  if (!partnerCode || !accessKey || !secretKey) return null

  const requestId = opts.orderId + '_' + Date.now()
  const requestType = 'captureWallet'
  const extraData = Buffer.from('{}').toString('base64')

  const rawSignature = `accessKey=${accessKey}&amount=${opts.amount}&extraData=${extraData}&ipnUrl=${opts.webhookUrl}&orderId=${opts.orderId}&orderInfo=${opts.orderInfo}&partnerCode=${partnerCode}&redirectUrl=${opts.returnUrl}&requestId=${requestId}&requestType=${requestType}`
  const signature = hmacSHA256(secretKey, rawSignature)

  const body = {
    partnerCode,
    accessKey,
    requestId,
    amount: String(opts.amount),
    orderId: opts.orderId,
    orderInfo: opts.orderInfo,
    redirectUrl: opts.returnUrl,
    ipnUrl: opts.webhookUrl,
    extraData,
    requestType,
    signature,
    lang: 'vi',
  }

  const res = await fetch(MOMO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.payUrl) return { payUrl: data.payUrl }
  return null
}

/** Verify MoMo webhook callback. Returns true if authentic. */
export function verifyMoMoCallback(params: Record<string, string>): boolean {
  const accessKey = process.env.MOMO_ACCESS_KEY
  const secretKey = process.env.MOMO_SECRET_KEY
  if (!accessKey || !secretKey) return false

  const signature = params['signature']
  if (!signature) return false

  const rawSignature = `accessKey=${accessKey}&amount=${params['amount']}&extraData=${params['extraData'] || ''}&message=${params['message'] || ''}&orderId=${params['orderId']}&orderInfo=${params['orderInfo'] || ''}&orderType=${params['orderType'] || ''}&partnerCode=${params['partnerCode']}&payType=${params['payType'] || ''}&requestId=${params['requestId']}&responseTime=${params['responseTime'] || ''}&resultCode=${params['resultCode']}&transId=${params['transId'] || ''}`
  const computed = hmacSHA256(secretKey, rawSignature)
  return signature === computed
}

function hmacSHA256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

// ZaloPay payment integration — real webhook with HMAC-SHA256 mac.
// REQUIRED .env:
//   ZALOPAY_APP_ID=your_app_id
//   ZALOPAY_KEY1=your_key1
//   ZALOPAY_KEY2=your_key2
// Get credentials: https://developer.zalopay.vn/

import crypto from 'crypto'

const ZALOPAY_API_URL = 'https://sandbox.zalopay.com.vn/v001/tpe/createorder'

/** Create a ZaloPay payment. Returns the order URL. */
export async function createZaloPayPayment(opts: {
  orderId: string
  amount: number
  orderInfo: string
  returnUrl: string
  webhookUrl: string
}): Promise<{ orderUrl: string } | null> {
  const appId = process.env.ZALOPAY_APP_ID
  const key1 = process.env.ZALOPAY_KEY1
  if (!appId || !key1) return null

  const appTransId = Date.now() + '_' + opts.orderId
  const embedData = JSON.stringify({ redirect_url: opts.returnUrl })
  const item = JSON.stringify([{ name: opts.orderInfo, price: opts.amount, quantity: 1 }])

  const order = {
    app_id: Number(appId),
    app_trans_id: appTransId,
    app_user: 'AVH',
    app_time: Date.now(),
    amount: opts.amount,
    item,
    embed_data: embedData,
    callback_url: opts.webhookUrl,
    description: opts.orderInfo,
  }

  const data = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`
  const mac = hmacSHA256(key1, data)

  const res = await fetch(ZALOPAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...order, mac } as any).toString(),
  })
  const result = await res.json()
  if (result.order_url) return { orderUrl: result.order_url }
  return null
}

/** Verify ZaloPay webhook callback. Returns true if authentic. */
export function verifyZaloPayCallback(body: Record<string, string>): boolean {
  const key2 = process.env.ZALOPAY_KEY2
  if (!key2) return false

  const mac = body['mac']
  if (!mac) return false

  const data = `${body['app_id'] || ''}|${body['app_trans_id'] || ''}|${body['embed_data'] || ''}|${body['amount'] || ''}|${body['appid'] || ''}|${body['zp_trans_id'] || ''}|${body['server_time'] || ''}|${body['channel'] || ''}|${body['merchant_user_id'] || ''}`
  const computed = hmacSHA256(key2, data)
  return mac === computed
}

function hmacSHA256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

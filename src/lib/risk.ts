// Automatic fraud / risk detection for incoming orders.
//
// We compute a list of risk flags at order creation. Each flag has:
//   key:    stable identifier
//   level:  'info' | 'warn' | 'block'
//   message: human-readable Vietnamese explanation
//
// The admin sees these flags in the orders tab and can decide whether to
// proceed, hold for manual verification, or cancel.

import { db } from '@/lib/db'

export interface RiskFlag {
  key: string
  level: 'info' | 'warn' | 'block'
  message: string
}

const HIGH_VALUE_THRESHOLD = 30_000_000 // 30 million VND
const VERY_HIGH_VALUE_THRESHOLD = 80_000_000 // 80 million VND
const DUPLICATE_PHONE_WINDOW_HOURS = 24
const MAX_ITEMS_FLAG = 10

export async function computeRiskFlags(opts: {
  total: number
  shippingPhone: string
  shippingName: string
  shippingAddress: string
  itemCount: number
  paymentMethod: string
  userId?: string
}): Promise<RiskFlag[]> {
  const flags: RiskFlag[] = []
  const { total, shippingPhone, shippingName, shippingAddress, itemCount, paymentMethod, userId } = opts

  // 1) High-value orders — require manual confirmation before shipping.
  if (total >= VERY_HIGH_VALUE_THRESHOLD) {
    flags.push({
      key: 'VERY_HIGH_VALUE',
      level: 'warn',
      message: `Đơn giá trị rất cao (${total.toLocaleString('vi-VN')}₫). Bắt buộc xác minh danh tính người mua + biên lai chuyển khoản trước khi giao.`,
    })
  } else if (total >= HIGH_VALUE_THRESHOLD) {
    flags.push({
      key: 'HIGH_VALUE',
      level: 'info',
      message: 'Đơn giá trị cao — nên gọi điện xác nhận trước khi xử lý.',
    })
  }

  // 2) Duplicate phone in the last 24h — possible bulk-order scam / card testing.
  if (shippingPhone) {
    const since = new Date(Date.now() - DUPLICATE_PHONE_WINDOW_HOURS * 3600_000)
    const recent = await db.order.count({
      where: { shippingPhone, createdAt: { gte: since } },
    })
    if (recent >= 3) {
      flags.push({
        key: 'DUPLICATE_PHONE',
        level: 'warn',
        message: `Số điện thoại ${shippingPhone} đã đặt ${recent} đơn trong 24h. Kiểm tra dấu hiệu lạm dụng / đặt đơn hàng loạt.`,
      })
    }
  }

  // 3) Bank transfer above threshold with no slip yet — flag for follow-up.
  if (paymentMethod === 'BANK' && total >= HIGH_VALUE_THRESHOLD) {
    flags.push({
      key: 'BANK_HIGH_VALUE_NO_SLIP',
      level: 'warn',
      message: 'Thanh toán chuyển khoản giá trị cao — không giao hàng cho đến khi khách tải lên biên lai và staff xác nhận.',
    })
  }

  // 4) Suspiciously large item count — could be a reseller or attack.
  if (itemCount >= MAX_ITEMS_FLAG) {
    flags.push({
      key: 'BULK_ITEMS',
      level: 'info',
      message: `Đơn chứa ${itemCount} sản phẩm — xác minh đây không phải đơn hàng loạt / gian lận tồn kho.`,
    })
  }

  // 5) Anonymous (no user account) + COD + high value — common COD-refusal risk.
  if (!userId && paymentMethod === 'COD' && total >= HIGH_VALUE_THRESHOLD) {
    flags.push({
      key: 'ANON_COD_HIGH_VALUE',
      level: 'warn',
      message: 'Khách chưa đăng nhập + COD + giá trị cao. Rủi ro từ chối nhận hàng cao — cân nhắc yêu cầu cọc trước.',
    })
  }

  // 6) Address too short — possibly fake.
  if (shippingAddress && shippingAddress.replace(/[,.\s]/g, '').length < 12) {
    flags.push({
      key: 'SHORT_ADDRESS',
      level: 'info',
      message: 'Địa chỉ giao hàng ngắn bất thường — xác minh lại trước khi lên đơn vị vận chuyển.',
    })
  }

  // 7) Name looks like gibberish (all caps + no space, or < 4 chars).
  const nm = shippingName.trim()
  if (nm.length < 4 || (!nm.includes(' ') && nm === nm.toUpperCase())) {
    flags.push({
      key: 'SUSPICIOUS_NAME',
      level: 'info',
      message: 'Tên người nhận trông bất thường — xác minh danh tính khi giao.',
    })
  }

  return flags
}

/** Whether any flag should BLOCK automatic processing. */
export function hasBlockingFlag(flags: RiskFlag[]): boolean {
  return flags.some((f) => f.level === 'block')
}

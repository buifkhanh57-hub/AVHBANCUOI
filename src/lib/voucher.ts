import { db } from '@/lib/db'

/**
 * Apply a voucher code server-side and return the discount amount (VND).
 * This MUST run on the server — the client should never compute the final
 * discount because it could be tampered with.
 */
export async function applyVoucherServerSide(
  code: string,
  subtotal: number
): Promise<{ ok: true; discount: number } | { ok: false; error: string }> {
  const voucher = await db.voucher.findUnique({ where: { code } })
  if (!voucher || !voucher.active) return { ok: false, error: 'Mã không hợp lệ' }
  const now = new Date()
  if (now < voucher.startAt || now > voucher.endAt) return { ok: false, error: 'Mã đã hết hạn' }
  if (subtotal < voucher.minOrder) {
    return {
      ok: false,
      error: `Cần đơn tối thiểu ${voucher.minOrder.toLocaleString('vi-VN')}₫`,
    }
  }
  let discount = 0
  if (voucher.type === 'PERCENT') {
    discount = Math.round((subtotal * voucher.value) / 100)
    if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount)
  } else if (voucher.type === 'FREE_SHIP') {
    discount = voucher.maxDiscount || voucher.value || 150000
  } else {
    discount = voucher.value
  }
  return { ok: true, discount }
}

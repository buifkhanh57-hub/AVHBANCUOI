// Utility helpers for Nội Thất AVH

/**
 * Format a number as Vietnamese đồng currency.
 * Example: 1250000 -> "1.250.000₫"
 */
export function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(value) + "₫"
}

/** Format a number compactly (e.g. 1500 -> "1,5k") */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(".0", "") + "M"
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(".0", "") + "k"
  return String(value)
}

/** Calculate discount percentage from price + comparePrice */
export function discountPct(price: number, comparePrice?: number | null): number {
  if (!comparePrice || comparePrice <= price) return 0
  return Math.round(((comparePrice - price) / comparePrice) * 100)
}

/**
 * Generate a human-readable order code: AVH + 6 random digits (e.g. AVH123456).
 *
 * Format matches SePay's webhook regex `^AVH[0-9]{6,8}$` — the bank transfer
 * note the customer types MUST contain this exact string for SePay to recognize
 * it as a payment reference. NO letters after AVH (e.g. AVH-QDQ5D2 is forbidden
 * because the hyphen + letters break the SePay regex).
 *
 * Caller is responsible for guaranteeing uniqueness — this function does
 * NOT check the DB. The orders API wraps it in a retry loop that regenerates
 * the code if the unique constraint fires.
 */
export function generateOrderCode(): string {
  let s = ""
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10).toString()
  return `AVH${s}`
}

/** Parse a JSON string field safely, returning fallback on error. */
export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** Truncate text with ellipsis */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + "…"
}

/** Build an order status timeline entry */
export function timelineEntry(status: string, note?: string) {
  return { status, at: new Date().toISOString(), note }
}

/** Vietnamese labels for order statuses */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  PROCESSING: "Đang xử lý",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK: "Chuyển khoản ngân hàng",
  // Legacy labels kept for backward compat (orders created before the cleanup)
  VNPAY: "VNPay QR",
  MOMO: "Ví MoMo",
  ZALOPAY: "ZaloPay",
  VIETHELL: "VietHell Pay",
}

/** Member tier display */
export const MEMBER_TIERS: Record<string, { label: string; color: string }> = {
  SILVER: { label: "Bạc", color: "text-slate-500" },
  GOLD: { label: "Vàng", color: "text-amber-600" },
  PLATINUM: { label: "Bạch Kim", color: "text-cyan-600" },
}

/** Simple slugify for Vietnamese + English text */
export function slugify(text: string): string {
  const map: Record<string, string> = {
    à: "a", á: "a", ạ: "a", ả: "a", ã: "a", â: "a", ầ: "a", ấ: "a", ậ: "a", ẩ: "a", ẫ: "a",
    ă: "a", ằ: "a", ắ: "a", ặ: "a", ẳ: "a", ẵ: "a",
    è: "e", é: "e", ẹ: "e", ẻ: "e", ẽ: "e", ê: "e", ề: "e", ế: "e", ệ: "e", ể: "e", ễ: "e",
    ì: "i", í: "i", ị: "i", ỉ: "i", ĩ: "i",
    ò: "o", ó: "o", ọ: "o", ỏ: "o", õ: "o", ô: "o", ồ: "o", ố: "o", ộ: "o", ổ: "o", ỗ: "o",
    ơ: "o", ờ: "o", ớ: "o", ợ: "o", ở: "o", ỡ: "o",
    ù: "u", ú: "u", ụ: "u", ủ: "u", ũ: "u", ư: "u", ừ: "u", ứ: "u", ự: "u", ử: "u", ữ: "u",
    ỳ: "y", ý: "y", ỵ: "y", ỷ: "y", ỹ: "y",
    đ: "d",
  }
  return text
    .toLowerCase()
    .split("")
    .map((c) => (c in map ? map[c] : c))
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

/** Normalize Vietnamese search (remove diacritics) for fuzzy matching */
export function normalizeVN(text: string): string {
  return slugify(text).replace(/-/g, " ")
}

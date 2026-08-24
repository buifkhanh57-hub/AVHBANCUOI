// Context injection for the chat AI.
// Before calling the LLM we fetch the FULL product catalog + any relevant
// order/voucher/policy data and inject it so the assistant answers with
// accurate store data instead of making things up.
//
// We also return a `products` array (with image URLs) so the chat widget
// can render product cards (image + name + price + "Xem sản phẩm" button)
// alongside the text reply.

import { db } from '@/lib/db'
import { parseJSON, formatVND, ORDER_STATUS_LABELS, normalizeVN } from '@/lib/format'

const ORDER_CODE_RE = /AVH[-\s]?[A-Z0-9]{4,8}/i

export interface ChatProductCard {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  image: string
  rating: number
  reviewCount: number
  category: string
  totalStock: number
  published: boolean
  isNew: boolean
  isFlashSale: boolean
}

export interface ChatContextResult {
  context: string
  products: ChatProductCard[]
}

/** Fetch ALL PUBLISHED products (only ones visible on the storefront).
 *  Recalled/deleted products are NOT included — the AI literally doesn't
 *  know about them, so it can never recommend a recalled product. */
async function fetchFullCatalog(): Promise<ChatProductCard[]> {
  const rows = await db.product.findMany({
    where: { published: true },
    include: {
      category: true,
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      variants: { select: { stock: true } },
    },
    orderBy: { createdAt: 'desc' }, // newest first so new uploads are at top
  })
  return rows.map((p) => {
    const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.basePrice,
      comparePrice: p.comparePrice,
      image: p.media[0]?.url ?? '/products/placeholder.png',
      rating: p.rating,
      reviewCount: p.reviewCount,
      category: p.category.name,
      totalStock,
      published: p.published,
      isNew: p.isNew,
      isFlashSale: p.isFlashSale,
    }
  })
}

/** Build the context + matched-product cards. */
export async function buildChatContext(message: string): Promise<ChatContextResult> {
  const parts: string[] = []
  const msg = message.toLowerCase().trim()
  const fullCatalog = await fetchFullCatalog()

  // Always inject the FULL catalog with rich detail so the AI can answer
  // accurately: what products exist, stock status, new arrivals, flash sale,
  // recalled/unpublished products. This prevents hallucination.
  if (fullCatalog.length > 0) {
    const lines = fullCatalog.map((p) => {
      const parts = [
        `• ${p.name} (slug: ${p.slug})`,
        `${formatVND(p.price)}`,
        p.comparePrice ? `(gốc ${formatVND(p.comparePrice)})` : '',
        `— ${p.category}`,
        `${p.rating?.toFixed(1) || 'chưa'}⭐`,
        `(${p.reviewCount} đánh giá)`,
      ]
      // Stock + status flags (published is always true here since we filter)
      const stock = p.totalStock
      const statusFlags: string[] = []
      if (stock <= 0) statusFlags.push('HẾT HÀNG')
      else if (stock <= 5) statusFlags.push(`sắp hết (còn ${stock})`)
      if (p.isNew) statusFlags.push('MỚI VỀ')
      if (p.isFlashSale) statusFlags.push('FLASH SALE')
      if (statusFlags.length) parts.push(`[${statusFlags.join(', ')}]`)
      return parts.filter(Boolean).join(' ')
    })
    parts.push(`— TOÀN BỘ DANH MỤC SẢN PHẨM (${fullCatalog.length} SP, dữ liệu thật) —\n${lines.join('\n')}`)
    parts.push(`\nLưu ý: Chỉ tư vấn sản phẩm đang bán (có hiện trên web). Nếu SP "ĐÃ THU HỒI" → thông báo khách sản phẩm đã ngừng kinh doanh. Sản phẩm "MỚI VỀ" → có thể giới thiệu cho khách.`)
  }

  // Determine which products to show as cards — match by keywords in the message.
  // Uses diacritic-insensitive matching so "bong den" matches "Đèn Bóng".
  // Includes NEW products the admin uploaded (fetchFullCatalog reads the live DB).
  const furnitureKeywords = ['sofa', 'giuong', 'bed', 'ban', 'table', 'ghe', 'chair',
    'tu', 'wardrobe', 'den', 'lamp', 'tham', 'rug', 'ke', 'shelf', 'noi that',
    'armchair', 'ban an', 'ban lam viec', 'desk', 'bong den', 'den trang tri',
    'san pham', 'mua', 'goi y', 'tu van', 'phong khach', 'phong ngu', 'phong an']
  const msgNorm = normalizeVN(msg)
  const hasFurnitureKeyword = furnitureKeywords.some((k) => msgNorm.includes(k))

  let cardProducts: ChatProductCard[] = []
  if (hasFurnitureKeyword || msgNorm.includes('goi y') || msgNorm.includes('tu van') || msgNorm.includes('san pham') || msgNorm.includes('mua')) {
    // Split message into meaningful words (≥3 chars) and match against product
    // names + categories — diacritic-insensitive.
    const words = msgNorm.split(/\s+/).filter((w) => w.length > 2)
    // Stop-word list so common filler words don't pollute matches.
    const stopWords = new Set(['toi', 'muon', 'mua', 'cho', 'va', 'hoac', 'nhung',
      'khong', 'co', 'gi', 'ma', 'thi', 'la', 'cua', 'nay', 'do', 'bay', 'sau',
      'truoc', 'tren', 'duoi', 'minh', 'ban', 'anh', 'chi', 'em', 'cho', 'va'])
    const queryWords = words.filter((w) => !stopWords.has(w) && w.length > 2)

    const matched = fullCatalog.filter((p) => {
      // Only show PUBLISHED products as cards (not recalled ones).
      if (!p.published) return false
      const hay = normalizeVN(p.name + ' ' + p.category)
      return queryWords.some((w) => hay.includes(w))
    })

    // Add RELATED products from the SAME categories as the matched products
    const matchedIds = new Set(matched.map((p) => p.id))
    const matchedCategories = new Set(matched.map((p) => p.category))
    const related = fullCatalog.filter((p) =>
      p.published && !matchedIds.has(p.id) && matchedCategories.has(p.category)
    )

    // Combine: matched first, then related — cap at 4.
    cardProducts = [...matched, ...related].slice(0, 4)
    // If nothing matched at all → return empty (don't spam random products).
    if (cardProducts.length === 0) cardProducts = []
  }

  // 2) Order lookup — if the message contains an order code
  const orderMatch = message.match(ORDER_CODE_RE)
  if (orderMatch) {
    const code = orderMatch[0].toUpperCase().replace(/\s/g, '')
    const order = await db.order.findUnique({
      where: { code },
      include: { items: true },
    })
    if (order) {
      parts.push(`— ĐƠN HÀNG ${order.code} —\n` +
        `Trạng thái: ${ORDER_STATUS_LABELS[order.status] || order.status}\n` +
        `Thanh toán: ${order.paymentStatus} (${order.paymentMethod})\n` +
        `Tổng: ${formatVND(order.total)}\n` +
        `Khách: ${order.shippingName} · ${order.shippingPhone}\n` +
        `Địa chỉ: ${order.shippingAddress}\n` +
        `Sản phẩm: ${order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}\n` +
        `Ngày đặt: ${new Date(order.createdAt).toLocaleString('vi-VN')}`)
    } else {
      parts.push(`— Đơn hàng ${code}: không tìm thấy. Hướng dẫn khách vào "Theo dõi đơn hàng".`)
    }
  }

  // 3) Voucher / promotion queries
  if (msg.includes('voucher') || msg.includes('mã giảm') || msg.includes('khuyến mãi') || msg.includes('flash sale') || msg.includes('sale')) {
    const vouchers = await db.voucher.findMany({ where: { active: true }, take: 5 })
    if (vouchers.length > 0) {
      const vlines = vouchers.map((v) =>
        `${v.code}: ${v.description} — ${v.type === 'PERCENT' ? `Giảm ${v.value}%` : `Giảm ${formatVND(v.value)}`} — Đơn tối thiểu ${formatVND(v.minOrder)}`
      )
      parts.push(`— VOUCHER ĐANG HIỆU LỰC —\n${vlines.join('\n')}`)
    }
    const flash = await db.flashSale.findFirst({ where: { active: true }, include: { products: { take: 5 } } })
    if (flash) {
      parts.push(`— FLASH SALE —\n${flash.name}: ${new Date(flash.startAt).toLocaleDateString('vi-VN')} → ${new Date(flash.endAt).toLocaleDateString('vi-VN')}, ${flash.products.length} sản phẩm`)
    }
  }

  // 4) Shipping / policy queries
  if (msg.includes('vận chuyển') || msg.includes('giao hàng') || msg.includes('ship') || msg.includes('phí ship') || msg.includes('bảo hành') || msg.includes('đổi trả')) {
    const settings = await db.setting.findMany()
    const get = (k: string) => settings.find((s) => s.key === k)?.value || ''
    parts.push(`— CHÍNH SÁCH CỬA HÀNG —\n` +
      `Miễn phí ship: đơn từ ${get('shipping_free_threshold') || '3.000.000'}₫\n` +
      `Bảo hành: ${get('warranty_text') || '12-36 tháng'}\n` +
      `Hỗ trợ: ${get('support_text') || '24/7'}\n` +
      `Hotline: ${get('contact_hotline') || '1900 1234'}`)
  }

  const context = parts.length > 0
    ? `THÔNG TIN CỬA HÀNG (dữ liệu thật — dùng để trả lời chính xác, KHÔNG bịa):\n${parts.join('\n\n')}\n\n---`
    : ''
  return { context, products: cardProducts }
}

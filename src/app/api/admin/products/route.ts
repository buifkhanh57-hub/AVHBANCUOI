import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON, slugify } from '@/lib/format'
import { logInfo, logWarn } from '@/lib/system-log'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/products — admin-scoped product list (includes unpublished).
 * Query params: page, limit, q (search), categoryId, lowStock=true.
 * Returns products with category + first media + variant stock info.
 */
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth

  try {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 60)))
    const q = sp.get('q')?.trim() || ''
    const categoryId = sp.get('categoryId') || undefined
    const lowStockOnly = sp.get('lowStock') === 'true'

    const where: Record<string, unknown> = {}
    if (categoryId) where['categoryId'] = categoryId
    if (q) {
      where['OR'] = [
        { name: { contains: q } },
        { brand: { contains: q } },
        { slug: { contains: q } },
      ]
    }

    const [total, rows] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          media: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
          variants: { select: { stock: true, price: true }, take: 1 },
        },
      }),
    ])

    const items = rows.map((p) => {
      const variant = p.variants[0]
      const stock = variant?.stock ?? 0
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        basePrice: p.basePrice,
        comparePrice: p.comparePrice,
        discountPct: p.discountPct,
        rating: p.rating,
        reviewCount: p.reviewCount,
        soldCount: p.soldCount,
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        isFlashSale: p.isFlashSale,
        published: p.published,
        stock,
        inStock: stock > 0,
        lowStock: stock > 0 && stock <= 5,
        category: p.category,
        image: p.media[0]?.url ?? '/products/placeholder.png',
        tags: parseJSON<string[]>(p.tags, []),
        colors: parseJSON<string[]>(p.colors, []),
        materials: parseJSON<string[]>(p.materials, []),
        createdAt: p.createdAt,
      }
    })

    const filtered = lowStockOnly ? items.filter((p) => p.lowStock) : items

    return NextResponse.json({
      success: true,
      data: {
        items: filtered,
        total: lowStockOnly ? filtered.length : total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((lowStockOnly ? filtered.length : total) / limit)),
      },
    })
  } catch (err) {
    console.error('[admin/products] GET error:', err)
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách sản phẩm' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/products — create a product.
 * PATCH /api/admin/products?id=ID — update a product.
 * In production these would be guarded by admin-role middleware.
 */
export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })

  const {
    name, categoryId, brand, description, basePrice, comparePrice,
    tags, specs, colors, materials, isFeatured, isNew, isFlashSale,
    imageUrl, media, stock = 0,
  } = body as Record<string, unknown>

  if (!name || !categoryId || !basePrice) {
    return NextResponse.json({ success: false, error: 'Thiếu tên, danh mục hoặc giá' }, { status: 400 })
  }
  // Validate price — SQLite INT maxes out at ~2.1 billion. Reject anything
  // larger to prevent P2023 "Conversion failed" crashes on read.
  const MAX_PRICE = 2_000_000_000
  if (Number(basePrice) > MAX_PRICE || (comparePrice && Number(comparePrice) > MAX_PRICE)) {
    return NextResponse.json({ success: false, error: `Giá không được vượt quá 2 tỷ ₫` }, { status: 400 })
  }
  const slug = slugify(String(name)) + '-' + Math.random().toString(36).slice(2, 6)
  const product = await db.product.create({
    data: {
      name: String(name),
      slug,
      categoryId: String(categoryId),
      brand: String(brand || 'AVH Home'),
      description: String(description || ''),
      tags: JSON.stringify(tags || []),
      specs: JSON.stringify(specs || {}),
      colors: JSON.stringify(colors || []),
      materials: JSON.stringify(materials || []),
      basePrice: Number(basePrice),
      comparePrice: comparePrice ? Number(comparePrice) : null,
      discountPct: comparePrice ? Math.round(((Number(comparePrice) - Number(basePrice)) / Number(comparePrice)) * 100) : 0,
      isFeatured: Boolean(isFeatured),
      isNew: Boolean(isNew),
      isFlashSale: Boolean(isFlashSale),
      published: true,
    },
  })

  // Media: accept either a `media` array of { url, type, thumbnail? } entries
  // (preferred — supports images AND videos with ordering), or fall back to a
  // single legacy `imageUrl` string for backwards compat.
  if (Array.isArray(media) && media.length) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i] as { url?: string; type?: string; thumbnail?: string }
      if (!m?.url) continue
      await db.productMedia.create({
        data: {
          productId: product.id,
          url: String(m.url),
          type: m.type === 'video' ? 'video' : 'image',
          thumbnail: m.thumbnail ? String(m.thumbnail) : null,
          sortOrder: i,
        },
      })
    }
  } else if (imageUrl) {
    await db.productMedia.create({
      data: { productId: product.id, url: String(imageUrl), type: 'image' },
    })
  }
  // create one default variant
  await db.productVariant.create({
    data: {
      productId: product.id,
      sku: slug.toUpperCase(),
      price: Number(basePrice),
      stock: Number(stock),
    },
  })
  return NextResponse.json({ success: true, data: { id: product.id, slug } })
}

export async function PATCH(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
  const allowed = ['name', 'brand', 'description', 'basePrice', 'comparePrice', 'isFeatured', 'isNew', 'isFlashSale', 'published', 'categoryId']
  const data: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) data[k] = body[k]
  // recompute discount
  if ('basePrice' in data || 'comparePrice' in data) {
    const product = await db.product.findUnique({ where: { id } })
    if (product) {
      const base = Number(data.basePrice ?? product.basePrice)
      const cmp = data.comparePrice !== undefined ? Number(data.comparePrice) : product.comparePrice
      data.discountPct = cmp ? Math.round(((Number(cmp) - base) / Number(cmp)) * 100) : 0
    }
  }
  if ('tags' in body) data.tags = JSON.stringify(body.tags)
  if ('specs' in body) data.specs = JSON.stringify(body.specs)
  if ('colors' in body) data.colors = JSON.stringify(body.colors)
  if ('materials' in body) data.materials = JSON.stringify(body.materials)
  const updated = await db.product.update({ where: { id }, data })
  return NextResponse.json({ success: true, data: { id: updated.id } })
}

export async function DELETE(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })

  // Find the product name for logging
  const product = await db.product.findUnique({ where: { id }, select: { name: true } })

  // ── Handle active orders containing this product ─────────────────────────
  // 1) CANCEL unpaid orders (paymentStatus = UNPAID or PENDING_VERIFY) that
  //    contain this product — the customer hasn't paid yet, so cancelling is
  //    safe and prevents shipping a deleted product.
  // 2) PAID orders are LEFT ALONE — the customer already paid; the order
  //    preserves the delivery timeline + shows in admin as before.
  const affectedOrders = await db.orderItem.findMany({
    where: { productId: id },
    select: { orderId: true },
  })
  const orderIds = [...new Set(affectedOrders.map((oi) => oi.orderId))]

  // Declare at function scope so we can use it in the return + log.
  let cancelledCount = 0

  if (orderIds.length > 0) {
    // Cancel unpaid orders + add timeline + notify
    const unpaidOrders = await db.order.findMany({
      where: {
        id: { in: orderIds },
        paymentStatus: { in: ['UNPAID', 'PENDING_VERIFY'] },
        status: { notIn: ['CANCELLED', 'REFUNDED', 'DELIVERED'] },
      },
      select: { id: true, code: true, userId: true },
    })
    cancelledCount = unpaidOrders.length

    for (const o of unpaidOrders) {
      const existing = await db.order.findUnique({ where: { id: o.id }, select: { timeline: true } })
      const timeline = JSON.parse(existing?.timeline || '[]')
      timeline.push({ status: 'CANCELLED', at: new Date().toISOString(), note: `Sản phẩm "${product?.name || id}" đã bị thu hồi — đơn tự động huỷ` })
      await db.order.update({
        where: { id: o.id },
        data: { status: 'CANCELLED', timeline: JSON.stringify(timeline) },
      })
      if (o.userId) {
        await db.notification.create({
          data: {
            userId: o.userId,
            type: 'ORDER',
            title: `Đơn ${o.code} đã bị huỷ`,
            body: `Sản phẩm "${product?.name}" đã bị thu hồi. Đơn ${o.code} được huỷ tự động. Vui lòng liên hệ hotline để được hỗ trợ.`,
            link: `order-tracking?code=${o.code}`,
          },
        })
      }
      logWarn('order', `Đơn ${o.code} tự huỷ do SP "${product?.name}" bị xoá`)
    }
  }

  // ── Hard delete: remove product + media + variants from DB ─────────────
  await db.productMedia.deleteMany({ where: { productId: id } })
  await db.productVariant.deleteMany({ where: { productId: id } })
  await db.product.delete({ where: { id } })

  logInfo('product', `Xoá sản phẩm "${product?.name || id}"`, `id=${id}, ${cancelledCount} đơn chưa thanh toán bị huỷ, ${orderIds.length - cancelledCount} đơn đã thanh toán được giữ`)

  return NextResponse.json({
    success: true,
    data: {
      cancelledOrders: cancelledCount,
      preservedOrders: orderIds.length - cancelledCount,
    },
  })
}

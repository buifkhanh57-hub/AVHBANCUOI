import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON, normalizeVN } from '@/lib/format'

/**
 * GET /api/products
 * Query params:
 *  q        — search by name (Vietnamese, diacritic-insensitive)
 *  category — category slug
 *  sort     — newest | price-asc | price-desc | best-selling | rating
 *  minPrice, maxPrice — price range (VND)
 *  material — comma list
 *  color    — comma list
 *  page, limit — pagination (default limit 12)
 *  featured, flashSale, isNew — boolean flags
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() || ''
  const category = sp.get('category')
  const sort = sp.get('sort') || 'newest'
  const minPrice = sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined
  const maxPrice = sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined
  const material = sp.get('material')?.split(',').filter(Boolean) || []
  const color = sp.get('color')?.split(',').filter(Boolean) || []
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(60, Math.max(1, Number(sp.get('limit') || 12)))
  const featured = sp.get('featured') === 'true'
  const flashSale = sp.get('flashSale') === 'true'
  const isNew = sp.get('isNew') === 'true'

  // Build where clause — SQLite has no full-text; emulate diacritic-insensitive
  // search by storing product names with diacritics and matching a normalised
  // LIKE against a normalised name column. For demo we just LIKE on name.
  // (In production, precompute a normalised name column.)
  const where: Record<string, unknown> = { published: true }
  if (featured) where['isFeatured'] = true
  if (flashSale) where['isFlashSale'] = true
  if (isNew) where['isNew'] = true

  if (category) {
    const cat = await db.category.findUnique({ where: { slug: category } })
    if (cat) where['categoryId'] = cat.id
  }

  if (q) {
    // Naive: split query into tokens, require all tokens as substrings of name
    // (case-insensitive). For Vietnamese diacritic-insensitive search we
    // fall back to scanning fetched rows if SQL LIKE fails — acceptable for
    // the demo catalog size.
    where['OR'] = [
      { name: { contains: q } },
      { description: { contains: q } },
      { brand: { contains: q } },
    ]
  }

  // Sorting
  const orderBy = (() => {
    switch (sort) {
      case 'price-asc':
        return { basePrice: 'asc' as const }
      case 'price-desc':
        return { basePrice: 'desc' as const }
      case 'best-selling':
        return { soldCount: 'desc' as const }
      case 'rating':
        return { rating: 'desc' as const }
      case 'newest':
      default:
        return { createdAt: 'desc' as const }
    }
  })()

  // Total count for pagination (before fetching page)
  const total = await db.product.count({ where })

  // Fetch page
  const rows = await db.product.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      category: true,
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      variants: true,
    },
  })

  // Apply diacritic-insensitive post-filter for `q` if present
  let filtered = rows
  if (q) {
    const qn = normalizeVN(q)
    filtered = rows.filter((p) =>
      normalizeVN(p.name).includes(qn) ||
      normalizeVN(p.description).includes(qn) ||
      normalizeVN(p.brand).includes(qn)
    )
  }

  // Apply material / color filter (JSON arrays stored as strings)
  if (material.length) {
    filtered = filtered.filter((p) => {
      const arr = parseJSON<string[]>(p.materials, [])
      return material.some((m) => arr.map((x) => x.toLowerCase()).includes(m.toLowerCase()))
    })
  }
  if (color.length) {
    filtered = filtered.filter((p) => {
      const arr = parseJSON<string[]>(p.colors, [])
      return color.some((c) => arr.map((x) => x.toLowerCase()).includes(c.toLowerCase()))
    })
  }
  if (minPrice != null) filtered = filtered.filter((p) => p.basePrice >= minPrice)
  if (maxPrice != null) filtered = filtered.filter((p) => p.basePrice <= maxPrice)

  // Shape response
  const data = filtered.map((p) => ({
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
    category: { id: p.category.id, slug: p.category.slug, name: p.category.name },
    image: p.media[0]?.url ?? '/products/placeholder.png',
    colors: parseJSON<string[]>(p.colors, []),
    materials: parseJSON<string[]>(p.materials, []),
    inStock: p.variants.some((v) => v.stock > 0),
  }))

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      total: filtered.length < rows.length ? filtered.length : total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((filtered.length < rows.length ? filtered.length : total) / limit)),
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON } from '@/lib/format'

/**
 * GET /api/products/[slug] — full product detail with media, variants, reviews, Q&A, related.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      media: { orderBy: { sortOrder: 'asc' } },
      variants: true,
      reviews: {
        where: { status: 'PUBLISHED' },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      questions: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!product || !product.published) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 })
  }

  // Related: same category, excluding self, limit 6
  const related = await db.product.findMany({
    where: {
      categoryId: product.categoryId,
      published: true,
      id: { not: product.id },
    },
    take: 6,
    orderBy: { soldCount: 'desc' },
    include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  })

  // Rating distribution
  const allReviews = product.reviews
  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: allReviews.filter((r) => r.rating === star).length,
  }))

  const data = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    description: product.description,
    basePrice: product.basePrice,
    comparePrice: product.comparePrice,
    discountPct: product.discountPct,
    rating: product.rating,
    reviewCount: product.reviewCount,
    soldCount: product.soldCount,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isFlashSale: product.isFlashSale,
    category: { id: product.category.id, slug: product.category.slug, name: product.category.name },
    specs: parseJSON<Record<string, string>>(product.specs, {}),
    tags: parseJSON<string[]>(product.tags, []),
    colors: parseJSON<string[]>(product.colors, []),
    materials: parseJSON<string[]>(product.materials, []),
    media: product.media.map((m) => ({ id: m.id, url: m.url, type: m.type, thumbnail: m.thumbnail, sortOrder: m.sortOrder })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      material: v.material,
      size: v.size,
      price: v.price,
      stock: v.stock,
    })),
    reviews: product.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      images: parseJSON<string[]>(r.images, []),
      verified: r.verified,
      reply: r.reply,
      repliedAt: r.repliedAt,
      createdAt: r.createdAt,
      user: r.user ? { name: r.user.name, avatarUrl: r.user.avatarUrl } : { name: 'Khách' },
    })),
    questions: product.questions.map((q) => ({
      id: q.id,
      askerName: q.askerName,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answeredAt,
      createdAt: q.createdAt,
    })),
    ratingDistribution: distribution,
    related: related.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      comparePrice: p.comparePrice,
      discountPct: p.discountPct,
      rating: p.rating,
      reviewCount: p.reviewCount,
      image: p.media[0]?.url ?? '/products/placeholder.png',
    })),
  }

  return NextResponse.json({ success: true, data })
}

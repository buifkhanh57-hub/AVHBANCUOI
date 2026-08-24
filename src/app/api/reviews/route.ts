import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON } from '@/lib/format'

/**
 * POST /api/reviews — submit a review.
 * Body: { productId, userId, rating, title, content, images? }
 * For demo we don't strictly enforce "verified purchase"; we mark verified=true
 * if the user has any completed order containing this product.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
  const { productId, userId, rating, title, content, images } = body as {
    productId: string
    userId?: string
    rating: number
    title?: string
    content: string
    images?: string[]
  }
  if (!productId || !content || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: 'Thiếu thông tin đánh giá' }, { status: 400 })
  }

  // verified purchase check (best-effort)
  let verified = false
  if (userId) {
    const orders = await db.order.findMany({
      where: { userId, status: { in: ['DELIVERED', 'SHIPPING'] } },
      include: { items: true },
    })
    verified = orders.some((o) => o.items.some((i) => i.productId === productId))
  }

  const review = await db.review.create({
    data: {
      productId,
      userId: userId || 'guest',
      rating: Number(rating),
      title: title || '',
      content,
      images: JSON.stringify(images || []),
      verified,
      status: 'PUBLISHED',
    },
    include: { user: { select: { name: true, avatarUrl: true } } },
  })

  // Update product aggregate rating + count
  const agg = await db.review.aggregate({
    where: { productId, status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: { rating: true },
  })
  await db.product.update({
    where: { id: productId },
    data: {
      rating: Math.round((agg._avg.rating || 0) * 10) / 10,
      reviewCount: agg._count.rating,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      images: parseJSON<string[]>(review.images, []),
      verified: review.verified,
      createdAt: review.createdAt,
      user: review.user ? { name: review.user.name, avatarUrl: review.user.avatarUrl } : { name: 'Khách' },
    },
  })
}

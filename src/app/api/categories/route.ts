import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON } from '@/lib/format'

// GET /api/categories — list all categories with product counts.
// productCount = published products only (visible on storefront).
// totalProductCount = all products (including unpublished) — shown in admin.
export async function GET() {
  const cats = await db.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true } }, // total (published + unpublished)
      products: { where: { published: true }, select: { id: true } }, // published only
    },
  })
  const data = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    imageUrl: c.imageUrl,
    productCount: c.products.length, // published only
    totalProductCount: c._count.products, // all (for admin)
    filterKeys: parseJSON<string[]>(c.filterKeys, []),
  }))
  return NextResponse.json({ success: true, data })
}

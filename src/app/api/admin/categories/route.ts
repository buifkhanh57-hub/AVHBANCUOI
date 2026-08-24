import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { slugify } from '@/lib/format'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * Category management endpoints (admin).
 *
 * POST   /api/admin/categories        — create a category
 * PATCH  /api/admin/categories?id=ID  — update name/icon/image
 * DELETE /api/admin/categories?id=ID  — delete (only if no products)
 */
export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body?.name) {
    return NextResponse.json({ success: false, error: 'Thiếu tên danh mục' }, { status: 400 })
  }
  const baseSlug = slugify(String(body.name))
  // ensure uniqueness
  let slug = baseSlug
  let n = 1
  while (await db.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`
  }
  const category = await db.category.create({
    data: {
      name: String(body.name),
      slug,
      icon: body.icon ? String(body.icon) : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      filterKeys: JSON.stringify(body.filterKeys || []),
    },
  })
  return NextResponse.json({ success: true, data: { id: category.id, slug } })
}

export async function PATCH(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, error: 'Dữ liệu không hợp lệ' }, { status: 400 })
  const data: Record<string, unknown> = {}
  if ('name' in body) data['name'] = String(body.name)
  if ('icon' in body) data['icon'] = body.icon ? String(body.icon) : null
  if ('imageUrl' in body) data['imageUrl'] = body.imageUrl ? String(body.imageUrl) : null
  if ('filterKeys' in body) data['filterKeys'] = JSON.stringify(body.filterKeys || [])
  const updated = await db.category.update({ where: { id }, data })
  return NextResponse.json({ success: true, data: { id: updated.id } })
}

export async function DELETE(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })

  // HARD DELETE: remove all products in this category (media + variants + product)
  // then delete the category itself. No hiding, no moving — the user explicitly
  // wants products gone when the category is deleted.
  const products = await db.product.findMany({
    where: { categoryId: id },
    select: { id: true },
  })

  if (products.length > 0) {
    const productIds = products.map((p) => p.id)
    await db.productMedia.deleteMany({ where: { productId: { in: productIds } } })
    await db.productVariant.deleteMany({ where: { productId: { in: productIds } } })
    await db.product.deleteMany({ where: { id: { in: productIds } } })
  }

  await db.category.delete({ where: { id } })
  return NextResponse.json({ success: true, data: { deletedProducts: products.length } })
}

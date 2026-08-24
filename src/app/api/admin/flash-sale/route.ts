import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * Flash sale management (admin).
 *
 * GET    /api/admin/flash-sale            — list all flash sales with product counts
 * POST   /api/admin/flash-sale            — create a flash sale
 * PATCH  /api/admin/flash-sale?id=ID      — update fields or attach/detach products
 *   body: { name?, startAt?, endAt?, active?, addProducts?: [ids], removeProducts?: [ids] }
 * DELETE /api/admin/flash-sale?id=ID      — delete (also unsets product.isFlashSale)
 */
export async function GET() {
  const sales = await db.flashSale.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { products: true } } },
  })
  const data = sales.map((s) => ({
    id: s.id,
    name: s.name,
    startAt: s.startAt,
    endAt: s.endAt,
    active: s.active,
    productCount: s._count.products,
    createdAt: s.createdAt,
  }))
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body?.name || !body.startAt || !body.endAt) {
    return NextResponse.json({ success: false, error: 'Thiếu tên, ngày bắt đầu hoặc kết thúc' }, { status: 400 })
  }
  const fs = await db.flashSale.create({
    data: {
      name: String(body.name),
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      active: body.active !== false,
    },
  })
  // optionally attach initial products
  if (Array.isArray(body.productIds) && body.productIds.length) {
    await db.flashSale.update({
      where: { id: fs.id },
      data: { products: { connect: body.productIds.map((id: string) => ({ id })) } },
    })
    // also flag products as isFlashSale
    await db.product.updateMany({
      where: { id: { in: body.productIds } },
      data: { isFlashSale: true },
    })
  }
  return NextResponse.json({ success: true, data: { id: fs.id } })
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
  if ('startAt' in body) data['startAt'] = new Date(body.startAt)
  if ('endAt' in body) data['endAt'] = new Date(body.endAt)
  if ('active' in body) data['active'] = Boolean(body.active)

  // connect/disconnect products
  let attached: string[] = []
  let detached: string[] = []
  if (Array.isArray(body.addProducts)) {
    attached = body.addProducts
    await db.product.updateMany({
      where: { id: { in: attached } },
      data: { isFlashSale: true },
    })
  }
  if (Array.isArray(body.removeProducts)) {
    detached = body.removeProducts
    await db.product.updateMany({
      where: { id: { in: detached } },
      data: { isFlashSale: false },
    })
  }

  await db.flashSale.update({
    where: { id },
    data: {
      ...data,
      products: {
        ...(attached.length ? { connect: attached.map((pid) => ({ id: pid })) } : {}),
        ...(detached.length ? { disconnect: detached.map((pid) => ({ id: pid })) } : {}),
      },
    },
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Thiếu id' }, { status: 400 })
  // unset isFlashSale on attached products before deleting
  const fs = await db.flashSale.findUnique({ where: { id }, include: { products: { select: { id: true } } } })
  if (fs?.products.length) {
    await db.product.updateMany({
      where: { id: { in: fs.products.map((p) => p.id) } },
      data: { isFlashSale: false },
    })
  }
  await db.flashSale.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

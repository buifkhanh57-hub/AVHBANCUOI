import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/stats — dashboard overview stats.
 * Protected: in production, check admin role from session token.
 */
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const [
    totalRevenue,
    orderCount,
    productCount,
    customerCount,
    pendingOrders,
    lowStockVariants,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    // total revenue: sum total of DELIVERED + PAID orders
    db.order.aggregate({
      where: { status: { in: ['DELIVERED', 'SHIPPING'] } },
      _sum: { total: true },
    }),
    db.order.count(),
    db.product.count(),
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.order.count({ where: { status: 'PENDING' } }),
    db.productVariant.count({ where: { stock: { lte: 5 } } }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { items: true },
    }),
    db.product.findMany({
      orderBy: { soldCount: 'desc' },
      take: 5,
      include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    }),
  ])

  // last 7 days revenue series for chart
  const now = new Date()
  const days: { date: string; revenue: number; orders: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now)
    day.setDate(now.getDate() - i)
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)
    const orders = await db.order.findMany({
      where: { createdAt: { gte: day, lt: next } },
      select: { total: true },
    })
    days.push({
      date: day.toISOString().slice(5, 10),
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
    })
  }

  // category breakdown
  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    success: true,
    data: {
      revenue: totalRevenue._sum.total || 0,
      orders: orderCount,
      products: productCount,
      customers: customerCount,
      pendingOrders,
      lowStock: lowStockVariants,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        code: o.code,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        shippingName: o.shippingName,
        itemCount: o.items.length,
        createdAt: o.createdAt,
      })),
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sold: p.soldCount,
        revenue: p.soldCount * p.basePrice,
        image: p.media[0]?.url ?? '/products/placeholder.png',
      })),
      revenueSeries: days,
      categoryBreakdown: categories.map((c) => ({
        name: c.name,
        productCount: c._count.products,
      })),
    },
  })
}

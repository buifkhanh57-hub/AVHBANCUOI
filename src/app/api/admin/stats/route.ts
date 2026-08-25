import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/stats — dashboard overview stats.
 *
 * Robust against:
 *   - Empty DB (aggregates return 0 / null → coerced to 0)
 *   - Null fields on Order/Product (recentOrders + topProducts safely read fields)
 *   - DB connection errors (try/catch returns 500 with helpful message)
 *
 * Protected: requires admin token.
 */
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth

  try {
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
      // total revenue: sum total of DELIVERED + SHIPPING orders
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
        revenue: orders.reduce((s, o) => s + (o?.total ?? 0), 0),
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
        // _sum.total is null when no matching rows — coerce to 0.
        revenue: totalRevenue?._sum?.total ?? 0,
        orders: orderCount ?? 0,
        products: productCount ?? 0,
        customers: customerCount ?? 0,
        pendingOrders: pendingOrders ?? 0,
        lowStock: lowStockVariants ?? 0,
        recentOrders: (recentOrders ?? []).map((o) => ({
          id: o.id,
          code: o.code,
          total: o.total ?? 0,
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          shippingName: o.shippingName,
          itemCount: o.items?.length ?? 0,
          createdAt: o.createdAt,
        })),
        topProducts: (topProducts ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sold: p.soldCount ?? 0,
          revenue: (p.soldCount ?? 0) * (p.basePrice ?? 0),
          image: p.media?.[0]?.url ?? '/products/placeholder.png',
        })),
        revenueSeries: days,
        categoryBreakdown: (categories ?? []).map((c) => ({
          name: c.name,
          productCount: c._count?.products ?? 0,
        })),
      },
    })
  } catch (err) {
    // Log full error server-side; return generic message to client.
    console.error('[admin/stats] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: 'Không thể tải thống kê — vui lòng kiểm tra kết nối cơ sở dữ liệu',
      },
      { status: 500 }
    )
  }
}

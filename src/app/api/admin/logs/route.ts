import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/logs?category=&level=&limit=100
 * Returns recent system logs (newest first).
 */
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const sp = req.nextUrl.searchParams
  const category = sp.get('category')
  const level = sp.get('level')
  const limit = Math.min(200, Number(sp.get('limit') || 100))

  const where: Record<string, unknown> = {}
  if (category) where['category'] = category
  if (level) where['level'] = level

  const logs = await db.systemLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ success: true, data: logs })
}

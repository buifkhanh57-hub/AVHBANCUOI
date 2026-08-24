import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/banners — active banners sorted by sortOrder
export async function GET() {
  const banners = await db.banner.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ success: true, data: banners })
}

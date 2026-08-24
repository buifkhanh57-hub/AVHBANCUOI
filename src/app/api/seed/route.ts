import { NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/seed'

// POST /api/seed?force=true  — seed (or re-seed) the database.
// In production this would be protected by an admin token.
export async function POST(req: Request) {
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'
  try {
    const counts = await seedDatabase(force)
    return NextResponse.json({ success: true, data: counts })
  } catch (err) {
    console.error('[seed] error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    )
  }
}

// GET /api/seed — also allow triggering via GET for convenience (e.g. browser prefetch)
export async function GET() {
  try {
    const counts = await seedDatabase(false)
    return NextResponse.json({ success: true, data: counts })
  } catch (err) {
    console.error('[seed] error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    )
  }
}

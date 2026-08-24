import { NextResponse } from 'next/server'
import { setupAdmins } from '@/lib/setup-admins'

// POST /api/setup-admins — one-time setup: delete demo admin@avh.vn + create
// 3 real admin accounts with hashed passwords. Idempotent.
export async function POST() {
  try {
    const log = await setupAdmins()
    return NextResponse.json({ success: true, data: log })
  } catch (err) {
    console.error('[setup-admins] error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Setup thất bại' },
      { status: 500 }
    )
  }
}

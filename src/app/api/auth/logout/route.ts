import { NextResponse } from 'next/server'

// POST /api/auth/logout — clear session (demo; no real cookie to clear)
export async function POST() {
  return NextResponse.json({ success: true })
}

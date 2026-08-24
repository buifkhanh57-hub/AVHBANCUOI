import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/me?email=... — for demo we look up by email.
 * In production the request carries an httpOnly refresh token cookie.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ success: true, data: null })
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (!user) return NextResponse.json({ success: true, data: null })
  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      loyaltyPoints: user.loyaltyPoints,
      memberTier: user.memberTier,
    },
  })
}

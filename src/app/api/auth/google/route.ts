import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { signAuthToken } from '@/lib/auth-token'
import { logInfo } from '@/lib/system-log'

/**
 * GET /api/auth/google — redirect to Google OAuth consent screen.
 * Bypasses NextAuth's internal provider (which has issues with Turbopack).
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/?error=google_not_configured', req.nextUrl.origin))
  }

  // Determine the external origin from forwarded headers (Caddy passes Host)
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${origin}/api/auth/google/callback`
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  })

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}

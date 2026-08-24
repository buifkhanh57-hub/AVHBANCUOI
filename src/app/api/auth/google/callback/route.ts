import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { signAuthToken } from '@/lib/auth-token'
import { logInfo } from '@/lib/system-log'
import { randomBytes } from 'crypto'

/**
 * GET /api/auth/google/callback — Google OAuth callback.
 * Google redirects here after the user selects their account + consents.
 * We exchange the code for user info, upsert the user, and redirect home
 * with the auth token in a cookie.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/?error=google_cancelled', req.nextUrl.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/?error=google_no_code', req.nextUrl.origin))
  }

  // Verify state (CSRF protection)
  const cookieState = req.cookies.get('oauth_state')?.value
  if (!state || state !== cookieState) {
    return NextResponse.redirect(new URL('/?error=google_state_mismatch', req.nextUrl.origin))
  }

  // Determine the external origin from forwarded headers (must match the redirect URI)
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${origin}/api/auth/google/callback`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('[google callback] token exchange failed:', err)
    return NextResponse.redirect(new URL('/?error=google_token_failed', req.nextUrl.origin))
  }

  const tokens = await tokenRes.json()

  // Get user info from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    return NextResponse.redirect(new URL('/?error=google_userinfo_failed', req.nextUrl.origin))
  }

  const googleUser = await userRes.json()
  const email = String(googleUser.email || '').toLowerCase().trim()
  const name = googleUser.name || googleUser.given_name || email.split('@')[0]
  const avatarUrl = googleUser.picture || null

  if (!email) {
    return NextResponse.redirect(new URL('/?error=google_no_email', req.nextUrl.origin))
  }

  // Upsert user in DB
  let user = await db.user.findUnique({ where: { email } })
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name,
        avatarUrl,
        role: 'CUSTOMER',
        authProviders: 'google',
        passwordHash: hashPassword('oauth-' + randomBytes(16).toString('hex')),
      },
    })
    logInfo('auth', `Google OAuth: tạo user mới ${email}`)
  } else {
    // Update avatar + link provider if not already
    const providers = user.authProviders.split(',').filter(Boolean)
    if (!providers.includes('google')) {
      await db.user.update({
        where: { id: user.id },
        data: {
          authProviders: [...providers, 'google'].join(','),
          avatarUrl: avatarUrl || user.avatarUrl,
        },
      })
    }
  }

  // Sign JWT token
  const token = await signAuthToken({ userId: user.id, email: user.email, role: user.role })

  // Redirect home with token in cookie (httpOnly, secure)
  const res = NextResponse.redirect(new URL('/?google_login=success', req.nextUrl.origin))
  res.cookies.set('avh_auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  // Also clear the oauth_state cookie
  res.cookies.delete('oauth_state')

  logInfo('auth', `Google OAuth login: ${email}`)
  return res
}

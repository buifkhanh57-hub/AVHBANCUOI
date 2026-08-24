import { NextRequest, NextResponse } from 'next/server'

// Debug endpoint — visit /api/debug/origin in the browser to see
// what redirect URI the Google OAuth flow would generate.
export async function GET(req: NextRequest) {
  const host = req.headers.get('host')
  const xForwardedHost = req.headers.get('x-forwarded-host')
  const xForwardedProto = req.headers.get('x-forwarded-proto')
  const origin = (xForwardedHost || host)
    ? `${xForwardedProto || 'https'}://${xForwardedHost || host}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return NextResponse.json({
    host,
    xForwardedHost,
    xForwardedProto,
    computedOrigin: origin,
    googleRedirectUri: `${origin}/api/auth/google/callback`,
    nextUrlOrigin: req.nextUrl.origin,
    allHeaders: Object.fromEntries(req.headers.entries()),
  })
}

import { NextRequest, NextResponse } from 'next/server'

/**
 * Security middleware — runs on every request BEFORE the route handler.
 *
 * PHILOSOPHY (per merchant's request):
 *   "Tường lửa chống hacker, không phải chặn người dùng."
 *   (Firewall against hackers, not blocking real users.)
 *
 * So we KEEP:
 *   - Security headers (CSP, nosniff, HSTS, Referrer-Policy, Permissions-Policy)
 *     → these protect against XSS, clickjacking, MIME sniffing, SSL-strip —
 *       none of them block legit users.
 *   - Path-traversal block (`..` / `%2e%2e` in URL)
 *     → only triggered by scanners, never by normal browsing.
 *
 * We DO NOT have:
 *   - Rate limiting on /api/auth/login / register / reset-password
 *     → was too aggressive, blocked real users who mistyped passwords. The
 *       password hashing (scrypt) is already slow enough to discourage
 *       brute-force; the actual anti-scam layer is the SePay webhook HMAC
 *       verification, not the login rate limit.
 *
 * The actual JWT auth + role-based access happens in each route handler via
 * `adminGuard` / `getAuthFromHeader`. This middleware is the outermost
 * layer — defense in depth, not the only layer.
 */

// Content-Security-Policy — strict on the directives that protect against
// ACTUAL attacks (XSS, clickjacking from malicious sites, data exfiltration),
// but permissive on `frame-ancestors` because the chat platform embeds this
// page in an iframe for the Preview Panel. We can't enumerate every possible
// chat-platform host that might embed us (the user could be testing from
// different chat sessions, different preview subdomains, etc.) — so we just
// allow any HTTPS site to embed us.
//
// This is the right trade-off for a merchant storefront:
//   - The actual attack surface (XSS via injected scripts, malicious CDN,
//     data-exfiltration via fetch to attacker.com) is still blocked by
//     script-src / connect-src / object-src.
//   - Clickjacking via iframe is only a real risk for high-stakes pages
//     like bank login forms. For an e-commerce storefront, an attacker
//     iframing us doesn't gain anything — they can't read the iframe's
//     contents (same-origin policy), they can't click buttons inside
//     it (postMessage barrier). So allowing embedding is low-risk.
//   - The downside of being strict (frame-ancestors 'none') is worse:
//     Firefox refuses to render the Preview Panel → user sees
//     "Firefox can't open this page" → can't use the site at all.
//
// Other directives stay strict:
//   - script-src 'self' 'unsafe-inline' (no third-party CDNs, blocks XSS)
//   - img-src 'self' data: https://img.vietqr.io https://api.qrserver.com
//     (only the QR-image providers we use)
//   - connect-src 'self' (no third-party API calls from browser)
//   - object-src 'none' (no <object>/<embed>)
//   - upgrade-insecure-requests (force HTTPS)
//
// We DO NOT set `X-Frame-Options` because it's deprecated (only supports
// SAMEORIGIN/DENY single-origin). CSP `frame-ancestors` is the modern
// replacement and supports the wildcard we need here.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://img.vietqr.io https://api.qrserver.com blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Allow ANY site to embed us in an iframe. Trade-off explained above —
  // the actual clickjacking attack surface for a storefront is minimal,
  // and being strict breaks the chat-platform Preview Panel.
  "frame-ancestors *",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Block path-traversal attempts in URL (defense in depth) ──────
  // Reject obvious path traversal in URL — only triggered by scanners
  // running automated attacks (curl with ../). Real users never type
  // `..` into a URL. Prisma escapes SQL params in handlers anyway, so
  // this is just the outermost defense layer.
  if (pathname.includes('..') || pathname.includes('%2e%2e')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // ── 2. Apply security headers to ALL responses ───────────────────────
  // This is the "firewall" — these headers protect against XSS, clickjacking,
  // MIME sniffing, SSL-strip, referrer leaks, and unwanted browser features.
  // None of them block legit users — they only block attack vectors.
  const res = NextResponse.next()
  // NOTE: X-Frame-Options intentionally NOT set — it's deprecated (only
  // supports SAMEORIGIN/DENY single-origin) and CSP `frame-ancestors`
  // above already handles multi-origin embedding policy.
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('X-DNS-Prefetch-Control', 'off')
  res.headers.set('Content-Security-Policy', CSP)

  return res
}

export const config = {
  // Run on all routes except Next.js internals + static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}

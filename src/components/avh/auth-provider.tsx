'use client'

// AuthProvider — previously wrapped the app in NextAuth's SessionProvider,
// which polls /api/auth/session every few seconds. When the server is busy
// (OOM, slow compilation, heavy API call), that endpoint returns non-JSON
// (empty body or HTML error page), causing the console error:
//   [next-auth][error][CLIENT_FETCH_ERROR] "JSON.parse: unexpected character..."
//
// We use our OWN JWT auth (auth-token.ts) — not NextAuth sessions. Google
// OAuth uses a direct redirect flow (window.location.href = '/api/auth/google'),
// and Apple Sign In uses NextAuth's redirect (signIn('apple')) but doesn't
// need client-side polling to work. So we can safely remove SessionProvider.
//
// If Apple Sign In is used, the callback URL will redirect back to the site
// and the JWT cookie (set by /api/auth/google/callback) is read in page.tsx
// on mount — no polling needed.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

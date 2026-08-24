// JWT auth token — sign/verify tokens using NEXTAUTH_SECRET.
// Used by admin API routes to verify the caller is an authenticated admin.

import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-dev-secret-change-in-production'
)

export interface AuthPayload {
  userId: string
  email: string
  role: string // CUSTOMER | ADMIN | STAFF
}

/** Sign a JWT token for a user (returned by login/register/oauth-login). */
export async function signAuthToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

/** Verify a JWT token and return the payload. Returns null if invalid. */
export async function verifyAuthToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

/** Extract + verify token from an Authorization header. Returns payload or null. */
export async function getAuthFromHeader(authHeader: string | null): Promise<AuthPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  return verifyAuthToken(token)
}

/**
 * Require admin role. Call at the top of every admin API route.
 * Returns the auth payload if OK, or a NextResponse (401/403) if not.
 */
export async function requireAdmin(authHeader: string | null): Promise<AuthPayload | { error: string; status: number }> {
  const payload = await getAuthFromHeader(authHeader)
  if (!payload) {
    return { error: 'Chưa đăng nhập hoặc token hết hạn', status: 401 }
  }
  if (payload.role !== 'ADMIN' && payload.role !== 'STAFF') {
    return { error: 'Không có quyền truy cập quản trị', status: 403 }
  }
  return payload
}

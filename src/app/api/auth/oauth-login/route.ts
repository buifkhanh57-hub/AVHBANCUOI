import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signAuthToken } from '@/lib/auth-token'
import { hashPassword } from '@/lib/password'
import { randomBytes } from 'crypto'

/**
 * POST /api/auth/oauth-login — simulated OAuth login for testing in preview.
 *
 * In production this endpoint is REPLACED by the real NextAuth OAuth callback
 * (/api/auth/callback/google, /api/auth/callback/apple). We provide this
 * simulated flow so the Google/Apple buttons in the auth dialog actually
 * work and log the user in when real OAuth credentials are not configured.
 *
 * Body: { provider: 'google' | 'apple', email, name? }
 * Behaviour:
 *   - If a user with that email exists → log them in (link the provider).
 *   - If not → create a CUSTOMER account (authProviders = provider).
 *   - Return the public user shape so the client can set the session.
 *
 * The provider field is stored so admins can see which users signed in via
 * which method; it has no security effect (the password is random + unused).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.provider || !body?.email) {
    return NextResponse.json({ success: false, error: 'Thiếu provider hoặc email' }, { status: 400 })
  }
  const provider = String(body.provider).toLowerCase()
  if (!['google', 'apple'].includes(provider)) {
    return NextResponse.json({ success: false, error: 'Provider không hợp lệ' }, { status: 400 })
  }
  const email = String(body.email).toLowerCase().trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!emailOk) {
    return NextResponse.json({ success: false, error: 'Email không hợp lệ' }, { status: 400 })
  }
  const name = body.name ? String(body.name).trim() : null

  let user = await db.user.findUnique({ where: { email } })
  if (!user) {
    // Create a new CUSTOMER account for this OAuth sign-in.
    user = await db.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role: 'CUSTOMER',
        authProviders: provider,
        // random unused password — this account can only log in via OAuth
        passwordHash: hashPassword('oauth-' + randomBytes(16).toString('hex')),
      },
    })
  } else {
    // Link the provider if not already linked.
    const providers = user.authProviders.split(',').filter(Boolean)
    if (!providers.includes(provider)) {
      await db.user.update({
        where: { id: user.id },
        data: { authProviders: [...providers, provider].join(',') },
      })
    }
  }

  const token = await signAuthToken({ userId: user.id, email: user.email, role: user.role })
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
      provider,
      token,
    },
  })
}

// NextAuth v4 configuration for Nội Thất AVH.
//
// Supports:
//   - Google OAuth 2.0 (real — requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
//   - Sign in with Apple (real — requires APPLE_CLIENT_ID + APPLE_SECRET)
//   - Email/password credentials (delegates to /api/auth/login)
//
// On successful OAuth, if the user doesn't exist in our DB we create them
// (role CUSTOMER). If they already exist (e.g. an admin who logs in via the
// same Google account), we link + return the existing record.
//
// To enable real OAuth you MUST add to .env:
//   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
//   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
//   APPLE_CLIENT_ID=com.yourcompany.noithat-avh
//   APPLE_SECRET=-----BEGIN PRIVATE KEY----- ... (the JWT client secret)
//   NEXTAUTH_URL=http://localhost:3000   (or your prod URL)
//   NEXTAUTH_SECRET=<any random 32+ char string>
//
// Without those env vars the OAuth providers simply won't be registered, and
// the Google/Apple buttons will show a "chưa cấu hình" hint instead of
// redirecting to a broken OAuth screen.

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { signAuthToken } from '@/lib/auth-token'

const has = (v?: string) => !!v && v.length > 0

const providers: NextAuthOptions['providers'] = [
  // Google OAuth — real if credentials are set
  ...(has(process.env.GOOGLE_CLIENT_ID) && has(process.env.GOOGLE_CLIENT_SECRET)
    ? [GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        profile(profile: any) {
          return {
            id: profile.sub,
            name: profile.name ?? profile.email,
            email: profile.email,
            image: profile.picture,
          }
        },
      })]
    : []),
  // Sign in with Apple — real if credentials are set
  ...(has(process.env.APPLE_CLIENT_ID) && has(process.env.APPLE_SECRET)
    ? [AppleProvider({
        clientId: process.env.APPLE_CLIENT_ID!,
        clientSecret: process.env.APPLE_SECRET!,
      })]
    : []),
  // Email/password credentials — always available
  CredentialsProvider({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Mật khẩu', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      const user = await db.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      })
      if (!user || !user.passwordHash) return null
      if (!verifyPassword(credentials.password, user.passwordHash)) return null
      return {
        id: user.id,
        name: user.name ?? undefined,
        email: user.email,
        image: user.avatarUrl ?? undefined,
        role: user.role,
      }
    },
  }),
]

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, make sure the user exists in our DB.
      if (account?.provider && account.provider !== 'credentials' && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
        if (!existing) {
          // Create a CUSTOMER account on first OAuth sign-in
          await db.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name || null,
              avatarUrl: user.image || null,
              role: 'CUSTOMER',
              authProviders: account.provider,
              // random unused password so this account can't be logged in via email/password
              passwordHash: hashPassword('oauth-' + Math.random().toString(36) + Date.now()),
            },
          })
        } else {
          // link the provider if not already linked
          const providers = existing.authProviders.split(',').filter(Boolean)
          if (!providers.includes(account.provider)) {
            await db.user.update({
              where: { id: existing.id },
              data: { authProviders: [...providers, account.provider].join(',') },
            })
          }
        }
      }
      return true
    },
    async jwt({ token, account, user }) {
      // On first sign-in OR if authToken is missing (legacy session), look up
      // the user and (re)sign the app-level JWT so admin APIs accept it.
      if (user || !token.authToken) {
        const email = (user?.email || token.email || '').toLowerCase()
        if (email) {
          const dbUser = await db.user.findUnique({ where: { email } })
          if (dbUser) {
            token.role = dbUser.role
            token.id = dbUser.id
            token.email = dbUser.email
            token.authToken = await signAuthToken({
              userId: dbUser.id,
              email: dbUser.email,
              role: dbUser.role,
            })
          }
        }
      }
      if (account?.provider) token.provider = account.provider
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).provider = token.provider
        // Expose the app-level JWT so the frontend can attach
        // Authorization: Bearer <token> to admin API requests.
        ;(session.user as any).token = token.authToken
      }
      return session
    },
  },
  pages: {
    // we use our own dialog; redirect here if someone hits the NextAuth signin page directly
    signIn: '/',
    error: '/',
  },
}

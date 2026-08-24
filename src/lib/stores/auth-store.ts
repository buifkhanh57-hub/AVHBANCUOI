'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'CUSTOMER' | 'ADMIN' | 'STAFF'
  avatarUrl?: string
  loyaltyPoints?: number
  memberTier?: string
  token?: string // JWT auth token — sent with admin API requests
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  setUser: (u: AuthUser | null) => void
  setLoading: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user, loading: false }),
      setLoading: (loading) => set({ loading }),
      logout: () => {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        set({ user: null })
      },
    }),
    { name: 'avh-auth', storage: createJSONStorage(() => localStorage) }
  )
)

/** Get the auth token for API requests. Returns null if not logged in. */
export function getAuthToken(): string | null {
  const state = useAuthStore.getState()
  return state.user?.token || null
}

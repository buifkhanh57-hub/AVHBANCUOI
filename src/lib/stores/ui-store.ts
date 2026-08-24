'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * UI navigation store — drives the SPA-style view switching since we are
 * constrained to a single `/` route. All "pages" are views rendered by the
 * root page based on `view` + optional params (e.g. selected product slug).
 */

export type ViewName =
  | 'home'
  | 'shop'
  | 'product'
  | 'cart'
  | 'checkout'
  | 'payment'
  | 'order-success'
  | 'wishlist'
  | 'account'
  | 'order-tracking'
  | 'admin'
  | 'blog'
  | 'blog-detail'
  | 'compare'

interface UIState {
  view: ViewName
  // params for the current view
  params: Record<string, string | undefined>
  // global cart drawer open
  cartOpen: boolean
  // AI chat widget open
  chatOpen: boolean
  // mobile search bar
  mobileSearchOpen: boolean
  setView: (view: ViewName, params?: Record<string, string | undefined>) => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  setMobileSearchOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      view: 'home',
      params: {},
      cartOpen: false,
      chatOpen: false,
      mobileSearchOpen: false,
      setView: (view, params = {}) => {
        set({ view, params, cartOpen: false, mobileSearchOpen: false })
        // Don't auto-scroll on view change — customers complained the smooth
        // scroll-to-top animation felt jarring (page "jumps up to the header"
        // whenever they clicked a product / category). They'd rather keep
        // their scroll position so they can browse naturally.
      },
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
      openChat: () => set({ chatOpen: true }),
      closeChat: () => set({ chatOpen: false }),
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
      setMobileSearchOpen: (v) => set({ mobileSearchOpen: v }),
    }),
    {
      name: 'avh-ui',
      storage: createJSONStorage(() => localStorage),
      // Don't persist transient UI flags
      partialize: (s) => ({ view: s.view, params: s.params }),
    }
  )
)

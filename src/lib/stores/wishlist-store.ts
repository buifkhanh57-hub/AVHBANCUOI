'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Wishlist store — list of product IDs the customer has favourited.
 * Persisted locally; synced to server on login in a real app.
 */

interface WishlistState {
  productIds: string[]
  toggle: (productId: string) => void
  has: (productId: string) => boolean
  remove: (productId: string) => void
  clear: () => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      toggle: (productId) =>
        set((s) => ({
          productIds: s.productIds.includes(productId)
            ? s.productIds.filter((id) => id !== productId)
            : [...s.productIds, productId],
        })),
      has: (productId) => get().productIds.includes(productId),
      remove: (productId) =>
        set((s) => ({ productIds: s.productIds.filter((id) => id !== productId) })),
      clear: () => set({ productIds: [] }),
    }),
    { name: 'avh-wishlist', storage: createJSONStorage(() => localStorage) }
  )
)

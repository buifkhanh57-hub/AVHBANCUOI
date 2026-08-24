'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Compare tray — lets customers place 2-3 products side by side.
 * Persisted so a page refresh keeps the comparison.
 */

interface CompareState {
  productIds: string[]
  max: number
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],
      max: 3,
      toggle: (id) =>
        set((s) => {
          if (s.productIds.includes(id)) {
            return { productIds: s.productIds.filter((x) => x !== id) }
          }
          if (s.productIds.length >= s.max) return s // ignore overflow
          return { productIds: [...s.productIds, id] }
        }),
      remove: (id) => set((s) => ({ productIds: s.productIds.filter((x) => x !== id) })),
      clear: () => set({ productIds: [] }),
    }),
    { name: 'avh-compare', storage: createJSONStorage(() => localStorage) }
  )
)

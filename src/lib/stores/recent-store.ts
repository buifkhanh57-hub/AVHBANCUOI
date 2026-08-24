'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface RecentProduct {
  id: string
  name: string
  slug: string
  image: string
  basePrice: number
}

interface RecentState {
  items: RecentProduct[]
  add: (p: RecentProduct) => void
  clear: () => void
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      items: [],
      add: (p) =>
        set((s) => ({
          items: [p, ...s.items.filter((i) => i.id !== p.id)].slice(0, 10),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'avh-recent', storage: createJSONStorage(() => localStorage) }
  )
)

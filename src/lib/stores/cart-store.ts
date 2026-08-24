'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Cart store. Items reference product + variant ids and a price snapshot.
 * We keep a client-side cart so the experience works instantly; when the
 * user checks out, the API re-validates prices server-side to prevent
 * tampering.
 */

export interface CartLine {
  productId: string
  variantId?: string
  name: string
  slug: string
  image: string
  color?: string
  material?: string
  size?: string
  unitPrice: number
  comparePrice?: number
  quantity: number
  needsInstallation?: boolean
}

interface CartState {
  items: CartLine[]
  voucherCode?: string
  addItem: (line: CartLine) => void
  updateQty: (productId: string, variantId: string | undefined, qty: number) => void
  removeItem: (productId: string, variantId?: string) => void
  clear: () => void
  setVoucher: (code?: string) => void
  count: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      voucherCode: undefined,
      addItem: (line) =>
        set((s) => {
          const idx = s.items.findIndex(
            (i) => i.productId === line.productId && i.variantId === line.variantId
          )
          if (idx >= 0) {
            const items = [...s.items]
            items[idx] = { ...items[idx], quantity: items[idx].quantity + line.quantity }
            return { items }
          }
          return { items: [...s.items, line] }
        }),
      updateQty: (productId, variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.productId === productId && i.variantId === variantId
                ? { ...i, quantity: Math.max(1, qty) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (productId, variantId) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        })),
      clear: () => set({ items: [], voucherCode: undefined }),
      setVoucher: (code) => set({ voucherCode: code }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      subtotal: () => get().items.reduce((n, i) => n + i.unitPrice * i.quantity, 0),
    }),
    { name: 'avh-cart', storage: createJSONStorage(() => localStorage) }
  )
)

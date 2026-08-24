'use client'

import { Button } from '@/components/ui/button'
import { GitCompareArrows, X } from 'lucide-react'
import { useCompareStore } from '@/lib/stores/compare-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import Image from 'next/image'

// Floating tray showing selected compare items
export function CompareTray() {
  const { productIds, remove, clear } = useCompareStore()
  const setView = useUIStore((s) => s.setView)

  const { data } = useQuery({
    queryKey: ['compare-products', productIds.join(',')],
    queryFn: async () => {
      if (!productIds.length) return []
      const res = await api.get<{ items: Array<{ id: string; name: string; slug: string; image: string; basePrice: number; comparePrice?: number | null; discountPct: number }> }>(
        `/api/products?limit=60`
      )
      return res.items.filter((p) => productIds.includes(p.id))
    },
    enabled: productIds.length > 0,
  })

  if (!productIds.length) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-lg avh-pop">
      <GitCompareArrows className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium">So sánh ({productIds.length}/3):</span>
      <div className="flex items-center gap-1.5">
        {data?.slice(0, 3).map((p) => (
          <div key={p.id} className="relative">
            <div className="relative h-8 w-8 overflow-hidden rounded-md border bg-muted">
              {p.image && <Image src={p.image} alt={p.name} fill sizes="32px" className="object-cover" />}
            </div>
            <button
              onClick={() => remove(p.id)}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              aria-label={`Bỏ ${p.name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setView('compare')}>
        So sánh ngay
      </Button>
      <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Xoá tất cả">
        Xoá
      </button>
    </div>
  )
}

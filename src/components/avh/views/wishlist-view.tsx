'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { useWishlistStore } from '@/lib/stores/wishlist-store'
import { ProductCard, ProductListItem } from '@/components/avh/product-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Heart, Trash2, ArrowRight } from 'lucide-react'

export function WishlistView() {
  const setView = useUIStore((s) => s.setView)
  const productIds = useWishlistStore((s) => s.productIds)
  const clear = useWishlistStore((s) => s.clear)

  // Fetch all products once; filter client-side to wishlist IDs
  const { data, isLoading } = useQuery<{ items: ProductListItem[] }>({
    queryKey: ['products', 'all-60'],
    queryFn: () => api.get('/api/products?limit=60'),
    staleTime: 5 * 60 * 1000,
  })

  const items =
    data?.items?.filter((p) => productIds.includes(p.id)) ?? []

  // Empty state
  if (!isLoading && items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Heart className="h-9 w-9" />
        </div>
        <h1 className="mt-5 text-xl font-bold sm:text-2xl">
          Chưa có sản phẩm yêu thích
        </h1>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Lưu lại những món đồ nội thất bạn yêu thích để dễ dàng theo dõi và mua
          lại sau.
        </p>
        <Button className="mt-6 gap-1.5" onClick={() => setView('shop')}>
          Khám phá sản phẩm <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Sản phẩm yêu thích
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {items.length} sản phẩm đã lưu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setView('shop')}
          >
            Tiếp tục mua sắm
          </Button>
          {items.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                clear()
              }}
            >
              <Trash2 className="h-4 w-4" />
              Xoá tất cả
            </Button>
          )}
        </div>
      </header>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useQuery, useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCompareStore } from '@/lib/stores/compare-store'
import { ProductListItem } from '@/components/avh/product-card'
import { StarRating } from '@/components/avh/star-rating'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVND, discountPct } from '@/lib/format'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  GitCompareArrows,
  Trash2,
  ArrowRight,
  X,
  Check,
  Minus,
  Info,
} from 'lucide-react'

interface ProductDetail {
  id: string
  name: string
  slug: string
  brand?: string
  basePrice: number
  comparePrice?: number | null
  discountPct: number
  rating: number
  reviewCount: number
  soldCount?: number
  category: { id: string; slug: string; name: string }
  specs: Record<string, string>
  tags: string[]
  colors: string[]
  materials: string[]
  variants: Array<{ id: string; color?: string; material?: string; size?: string; price: number; stock: number }>
  inStock: boolean
}

// Common spec keys we always surface in the table (translated labels)
const SPEC_LABELS: Record<string, string> = {
  brand: 'Thương hiệu',
  material: 'Chất liệu',
  color: 'Màu sắc',
  size: 'Kích thước',
  weight: 'Trọng lượng',
  warranty: 'Bảo hành',
  origin: 'Xuất xứ',
  dimensions: 'Kích thước (D × R × C)',
  capacity: 'Sức chứa',
  thickness: 'Độ dày',
}

// Pre-defined comparison rows (always shown) + dynamically collected from specs
const FIXED_ROWS: { key: string; label: string; getter: (p: ProductDetail) => string }[] = [
  {
    key: 'price',
    label: 'Giá bán',
    getter: (p) => formatVND(p.basePrice),
  },
  {
    key: 'comparePrice',
    label: 'Giá gốc',
    getter: (p) =>
      p.comparePrice && p.comparePrice > p.basePrice
        ? formatVND(p.comparePrice)
        : '—',
  },
  {
    key: 'discountPct',
    label: 'Giảm giá',
    getter: (p) => (p.discountPct > 0 ? `-${p.discountPct}%` : '—'),
  },
  {
    key: 'rating',
    label: 'Đánh giá',
    getter: (p) => `${p.rating.toFixed(1)} (${p.reviewCount} lượt)`,
  },
  {
    key: 'soldCount',
    label: 'Đã bán',
    getter: (p) =>
      p.soldCount != null && p.soldCount > 0
        ? p.soldCount.toLocaleString('vi-VN')
        : '—',
  },
  {
    key: 'colors',
    label: 'Màu sắc',
    getter: (p) => (p.colors?.length ? p.colors.join(', ') : '—'),
  },
  {
    key: 'materials',
    label: 'Chất liệu',
    getter: (p) => (p.materials?.length ? p.materials.join(', ') : '—'),
  },
  {
    key: 'inStock',
    label: 'Còn hàng',
    getter: (p) => (p.inStock ? 'Còn hàng' : 'Hết hàng'),
  },
]

export function CompareView() {
  const productIds = useCompareStore((s) => s.productIds)
  const remove = useCompareStore((s) => s.remove)
  const clear = useCompareStore((s) => s.clear)
  const setView = useUIStore((s) => s.setView)

  // Fetch all products once to map id → slug (since there's no by-ids endpoint)
  const { data: listData, isLoading: listLoading } = useQuery<{
    items: ProductListItem[]
  }>({
    queryKey: ['products', 'all-60'],
    queryFn: () => api.get('/api/products?limit=60'),
    staleTime: 5 * 60 * 1000,
  })

  // Resolve compare products (filter by id)
  const compareProducts: ProductListItem[] =
    listData?.items?.filter((p) => productIds.includes(p.id)) ?? []

  // Fetch full detail for each compare product via useQueries
  const detailQueries = useQueries({
    queries: compareProducts.map((p) => ({
      queryKey: ['product', p.slug],
      queryFn: () => api.get<ProductDetail>(`/api/products/${p.slug}`),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const details: (ProductDetail | undefined)[] = detailQueries.map((q) =>
    q.data ? { ...q.data, inStock: q.data.variants?.some((v) => v.stock > 0) ?? true } : undefined
  )
  const detailLoading = detailQueries.some((q) => q.isLoading)

  // Empty state
  if (!listLoading && productIds.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <GitCompareArrows className="h-9 w-9" />
        </div>
        <h1 className="mt-5 text-xl font-bold sm:text-2xl">
          Chưa có sản phẩm để so sánh
        </h1>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Thêm 2-3 sản phẩm vào khay so sánh để xem bảng đối chiếu chi tiết:
          giá, chất liệu, kích thước, đánh giá và nhiều thông số khác.
        </p>
        <Button className="mt-6 gap-1.5" onClick={() => setView('shop')}>
          Đi mua sắm <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Loading state for products list
  if (listLoading) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-4">
        <Skeleton className="mb-5 h-8 w-48" />
        <div className="overflow-x-auto">
          <div className="grid min-w-[600px] grid-cols-[160px_repeat(2,1fr)] gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Compute spec keys gathered from all products' specs (union, in insertion order)
  const specKeys: string[] = []
  const seen = new Set<string>()
  for (const d of details) {
    if (!d) continue
    if (d.specs) {
      for (const k of Object.keys(d.specs)) {
        if (!seen.has(k)) {
          seen.add(k)
          specKeys.push(k)
        }
      }
    }
  }

  const loadingAny = detailLoading || details.some((d) => !d)

  // Helper: figure out if row values differ across products (to highlight)
  const isRowDifferent = (values: string[]) => {
    if (values.length < 2) return false
    const first = values[0]
    return values.some((v) => v !== first)
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GitCompareArrows className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">So sánh sản phẩm</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {productIds.length} sản phẩm đang so sánh (tối đa 3)
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
            Thêm sản phẩm
          </Button>
          {productIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                clear()
                toast.success('Đã xoá danh sách so sánh')
              }}
            >
              <Trash2 className="h-4 w-4" /> Xoá tất cả
            </Button>
          )}
        </div>
      </header>

      {compareProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 py-12 text-center">
          <GitCompareArrows className="h-10 w-10 text-muted-foreground/50" />
          <p className="font-semibold">Các sản phẩm đã bị xoá khỏi khay</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Thêm sản phẩm vào khay so sánh để tiếp tục.
          </p>
          <Button
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => setView('shop')}
          >
            Đi mua sắm <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            {/* Header row: product info */}
            <thead>
              <tr className="border-b bg-muted/40">
                <th
                  scope="col"
                  className="w-[140px] p-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:w-[180px]"
                >
                  Đặc điểm
                </th>
                {compareProducts.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className="border-l border-border/60 p-3 align-top"
                  >
                    <ProductColumnHeader
                      product={p}
                      onRemove={() => {
                        remove(p.id)
                        toast.success('Đã bỏ khỏi so sánh')
                      }}
                      onViewDetail={() =>
                        setView('product', { slug: p.slug })
                      }
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Fixed comparison rows */}
              {FIXED_ROWS.map((row, i) => {
                const values =
                  details.map((d) => (d ? row.getter(d) : '—')) ?? []
                const highlight = isRowDifferent(values)
                return (
                  <tr
                    key={row.key}
                    className={`border-b border-border/60 ${
                      i % 2 === 0 ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </td>
                    {compareProducts.map((_, idx) => (
                      <td
                        key={idx}
                        className={`border-l border-border/60 p-3 align-middle ${
                          highlight ? 'bg-primary/5' : ''
                        }`}
                      >
                        {row.key === 'rating' ? (
                          <div className="flex flex-col gap-1">
                            <StarRating
                              value={details[idx]?.rating ?? 0}
                              size={12}
                            />
                            <span className="text-xs">
                              {values[idx]}
                            </span>
                          </div>
                        ) : row.key === 'inStock' ? (
                          <SpecBooleanCell
                            value={details[idx]?.inStock}
                          />
                        ) : row.key === 'price' ? (
                          <span className="font-semibold text-primary">
                            {values[idx]}
                          </span>
                        ) : (
                          <span>{values[idx]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}

              {/* Dynamic spec rows gathered from products' specs */}
              {specKeys.map((key, i) => {
                const values = details.map((d) =>
                  d?.specs?.[key] ? d.specs[key] : '—'
                )
                const highlight = isRowDifferent(values)
                return (
                  <tr
                    key={key}
                    className={`border-b border-border/60 ${
                      (FIXED_ROWS.length + i) % 2 === 0 ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {SPEC_LABELS[key] || key}
                    </td>
                    {compareProducts.map((_, idx) => (
                      <td
                        key={idx}
                        className={`border-l border-border/60 p-3 align-middle ${
                          highlight ? 'bg-primary/5' : ''
                        }`}
                      >
                        <SpecValueCell value={values[idx]} />
                      </td>
                    ))}
                  </tr>
                )
              })}

              {/* Loading placeholder row when detail still loading */}
              {loadingAny && (
                <tr>
                  <td className="p-3 text-xs text-muted-foreground">
                    Đang tải thông số…
                  </td>
                  {compareProducts.map((_, idx) => (
                    <td
                      key={idx}
                      className="border-l border-border/60 p-3"
                    >
                      <Skeleton className="h-4 w-16" />
                    </td>
                  ))}
                </tr>
              )}

              {/* Action row */}
              <tr>
                <td className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hành động
                </td>
                {compareProducts.map((p) => (
                  <td
                    key={p.id}
                    className="border-l border-border/60 p-3 align-middle"
                  >
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full gap-1.5"
                      onClick={() => setView('product', { slug: p.slug })}
                    >
                      Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Hint footer */}
      <div className="mt-4 flex flex-col items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:flex-row">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Các ô được tô màu nhấn là các thông số khác biệt giữa các sản phẩm.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setView('shop')}
          disabled={compareProducts.length >= 3}
        >
          Tiếp tục so sánh <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Product column header (image + name + price + actions) ---------------- */

function ProductColumnHeader({
  product,
  onRemove,
  onViewDetail,
}: {
  product: ProductListItem
  onRemove: () => void
  onViewDetail: () => void
}) {
  const disc =
    product.discountPct || discountPct(product.basePrice, product.comparePrice)
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="200px"
          className="object-cover"
        />
        <button
          onClick={onRemove}
          aria-label="Bỏ khỏi so sánh"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {disc > 0 && (
          <Badge className="absolute left-1.5 top-1.5 bg-red-600 text-white">
            -{disc}%
          </Badge>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug">
        {product.name}
      </p>
      {product.category?.name && (
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {product.category.name}
        </span>
      )}
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-semibold text-primary">
          {formatVND(product.basePrice)}
        </span>
        {product.comparePrice &&
          product.comparePrice > product.basePrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatVND(product.comparePrice)}
            </span>
          )}
      </div>
      <StarRating
        value={product.rating}
        count={product.reviewCount}
        size={11}
      />
      <Button
        size="sm"
        variant="outline"
        className="mt-1 w-full gap-1.5"
        onClick={onViewDetail}
      >
        Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* ---------------- Spec value cell ---------------- */

function SpecValueCell({ value }: { value: string }) {
  if (!value || value === '—' || value === '-') {
    return (
      <span className="inline-flex items-center text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
      </span>
    )
  }
  // Boolean-like
  const lower = value.toLowerCase()
  if (lower === 'true' || lower === 'có' || lower === 'yes') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Check className="h-3.5 w-3.5" /> Có
      </span>
    )
  }
  if (lower === 'false' || lower === 'không' || lower === 'no') {
    return (
      <span className="inline-flex items-center gap-1 text-red-500">
        <X className="h-3.5 w-3.5" /> Không
      </span>
    )
  }
  return <span className="text-foreground/90">{value}</span>
}

function SpecBooleanCell({ value }: { value?: boolean }) {
  if (value === undefined) {
    return (
      <span className="inline-flex items-center text-muted-foreground">
        <Minus className="h-3.5 w-3.5" />
      </span>
    )
  }
  return value ? (
    <span className="inline-flex items-center gap-1 text-emerald-600">
      <Check className="h-3.5 w-3.5" /> Còn hàng
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-500">
      <X className="h-3.5 w-3.5" /> Hết hàng
    </span>
  )
}

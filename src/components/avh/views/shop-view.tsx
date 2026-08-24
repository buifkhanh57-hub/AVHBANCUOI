'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  SlidersHorizontal, Search, X, Flame, ChevronRight, Frown, Home as HomeIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { ProductCard, ProductListItem } from '@/components/avh/product-card'
import { CountdownTimer } from '@/components/avh/countdown-timer'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  imageUrl?: string
  productCount: number
  filterKeys?: string[]
}

interface ProductListResponse {
  items: ProductListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price-asc', label: 'Giá tăng dần' },
  { value: 'price-desc', label: 'Giá giảm dần' },
  { value: 'best-selling', label: 'Bán chạy' },
  { value: 'rating', label: 'Đánh giá cao' },
]

const MATERIAL_OPTIONS = [
  'Gỗ tự nhiên', 'Gỗ công nghiệp', 'MDF', 'Vải', 'Da', 'Nhựa', 'Kim loại', 'Tre',
]
const COLOR_OPTIONS = [
  'Nâu', 'Trắng', 'Đen', 'Xám', 'Be', 'Vàng', 'Xanh lá', 'Đỏ',
]
// Hex swatches for color preview
const COLOR_SWATCH: Record<string, string> = {
  'Nâu': '#7b4b2a',
  'Trắng': '#f5f1ea',
  'Đen': '#1c1917',
  'Xám': '#9ca3af',
  'Be': '#d8c4a8',
  'Vàng': '#eab308',
  'Xanh lá': '#4d7c3a',
  'Đỏ': '#b91c1c',
}

const PRICE_PRESETS = [
  { label: '< 2 triệu', min: 0, max: 2_000_000 },
  { label: '2 - 5 triệu', min: 2_000_000, max: 5_000_000 },
  { label: '5 - 10 triệu', min: 5_000_000, max: 10_000_000 },
  { label: '10 - 20 triệu', min: 10_000_000, max: 20_000_000 },
  { label: '> 20 triệu', min: 20_000_000, max: 100_000_000 },
]

export function ShopView() {
  const params = useUIStore((s) => s.params)
  const setView = useUIStore((s) => s.setView)

  // --- Filter state (initialized from URL-like params once on mount) ---
  // Navigation params (driven by header / homepage clicks)
  const [navCat, setNavCat] = useState<string | undefined>(params.cat)
  const [navQ, setNavQ] = useState<string | undefined>(params.q)
  const [navSort, setNavSort] = useState<string>(params.sort || 'newest')
  const [navFlash, setNavFlash] = useState<boolean>(params.flashSale === 'true')
  const [navIsNew, setNavIsNew] = useState<boolean>(params.isNew === 'true')

  // Local-only filters
  const [materials, setMaterials] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>(params.q || '')
  const [page, setPage] = useState<number>(1)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Sync navigation-driven state when params change (e.g. user clicks a new
  // category in the header while already on the shop view). We use the
  // "adjust state during render" pattern recommended by React docs instead of
  // setState-in-effect, which avoids cascading renders.
  const paramsKey = `${params.cat ?? ''}|${params.q ?? ''}|${params.sort ?? ''}|${params.flashSale ?? ''}|${params.isNew ?? ''}`
  const [prevParamsKey, setPrevParamsKey] = useState(paramsKey)
  if (paramsKey !== prevParamsKey) {
    setPrevParamsKey(paramsKey)
    setNavCat(params.cat)
    setNavQ(params.q)
    setNavSort(params.sort || 'newest')
    setNavFlash(params.flashSale === 'true')
    setNavIsNew(params.isNew === 'true')
    setSearchInput(params.q || '')
    setPage(1)
  }

  // Reset page to 1 whenever any filter changes — also done during render to
  // avoid the setState-in-effect pattern.
  const filterKey = `${navCat ?? ''}|${navQ ?? ''}|${navSort}|${navFlash}|${navIsNew}|${materials.join(',')}|${colors.join(',')}|${minPrice}|${maxPrice}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  // --- Build the API URL from current filter state ---
  const apiUrl = useMemo(() => {
    const u = new URL('/api/products', window.location.origin)
    if (navQ) u.searchParams.set('q', navQ)
    if (navCat) u.searchParams.set('category', navCat)
    if (navSort) u.searchParams.set('sort', navSort)
    if (navFlash) u.searchParams.set('flashSale', 'true')
    if (navIsNew) u.searchParams.set('isNew', 'true')
    if (minPrice) u.searchParams.set('minPrice', minPrice)
    if (maxPrice) u.searchParams.set('maxPrice', maxPrice)
    if (materials.length) u.searchParams.set('material', materials.join(','))
    if (colors.length) u.searchParams.set('color', colors.join(','))
    u.searchParams.set('page', String(page))
    u.searchParams.set('limit', '12')
    return u.pathname + u.search
  }, [navQ, navCat, navSort, navFlash, navIsNew, minPrice, maxPrice, materials, colors, page])

  const { data, isLoading, isError, error } = useQuery<ProductListResponse>({
    queryKey: ['shop', apiUrl],
    queryFn: () => api.get(apiUrl),
    enabled: typeof window !== 'undefined',
    staleTime: 30_000,
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories'),
    staleTime: 5 * 60_000,
  })

  const activeCategory = useMemo(
    () => categories?.find((c) => c.slug === navCat),
    [categories, navCat]
  )

  const pageTitle = navFlash
    ? 'Flash Sale'
    : navIsNew
      ? 'Hàng mới về'
      : activeCategory?.name || (navQ ? `Tìm kiếm: "${navQ}"` : 'Tất cả sản phẩm')

  // Stable flash sale countdown target (next ~23h59m)
  const flashTarget = useMemo(() => {
    const d = new Date()
    d.setHours(d.getHours() + 23, 59, 59, 999)
    return d
  }, [navFlash])

  const hasActiveFilters =
    !!navCat || !!navQ || navFlash || navIsNew ||
    materials.length > 0 || colors.length > 0 ||
    !!minPrice || !!maxPrice

  function clearAllFilters() {
    setNavCat(undefined)
    setNavQ(undefined)
    setNavFlash(false)
    setNavIsNew(false)
    setMaterials([])
    setColors([])
    setMinPrice('')
    setMaxPrice('')
    setSearchInput('')
    setView('shop', {})
    toast.success('Đã xóa bộ lọc')
  }

  function applySearch(e: React.FormEvent) {
    e.preventDefault()
    setNavQ(searchInput.trim() || undefined)
  }

  function toggleArray(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
  }

  function handleCategoryClick(slug: string | undefined) {
    setNavCat(slug)
    // also reflect to store params so breadcrumb stays in sync
    setView('shop', {
      ...(slug ? { cat: slug } : {}),
      q: navQ,
      sort: navSort,
      flashSale: navFlash ? 'true' : undefined,
      isNew: navIsNew ? 'true' : undefined,
    })
  }

  function goToPage(p: number) {
    setPage(Math.max(1, Math.min(p, data?.totalPages || 1)))
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Build pagination page list (current ±2, clamped)
  const pageItems = useMemo(() => {
    const total = data?.totalPages || 1
    const cur = page
    const arr: (number | 'ellipsis')[] = []
    const push = (n: number | 'ellipsis') => arr.push(n)
    if (total <= 7) {
      for (let i = 1; i <= total; i++) push(i)
    } else {
      push(1)
      if (cur > 4) push('ellipsis')
      const start = Math.max(2, cur - 1)
      const end = Math.min(total - 1, cur + 1)
      for (let i = start; i <= end; i++) push(i)
      if (cur < total - 3) push('ellipsis')
      push(total)
    }
    return arr
  }, [data?.totalPages, page])

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="cursor-pointer"
              onClick={() => setView('home')}
            >
              <HomeIcon className="h-3.5 w-3.5" /> Trang chủ
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => setView('shop')}>
              Sản phẩm
            </BreadcrumbLink>
          </BreadcrumbItem>
          {activeCategory && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeCategory.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Flash sale banner */}
      {navFlash && (
        <div className="mb-4 overflow-hidden rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/30">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-red-600" />
              <h1 className="text-lg font-bold text-red-700 dark:text-red-400 sm:text-2xl">⚡ Flash Sale Đang Diễn Ra</h1>
              <Badge className="bg-red-600 text-white">Cực sốc</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Kết thúc trong</span>
              <CountdownTimer target={flashTarget} variant="dark" size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Đang tải sản phẩm…'
              : `${data?.total ?? 0} sản phẩm`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter trigger */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden gap-1.5">
                <SlidersHorizontal className="h-4 w-4" /> Lọc
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85%] max-w-sm overflow-y-auto sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Bộ lọc sản phẩm</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <FilterPanel
                  searchInput={searchInput}
                  onSearch={applySearch}
                  onSearchInputChange={(v) => setSearchInput(v)}
                  navCat={navCat}
                  onNavCat={(s) => handleCategoryClick(s)}
                  categories={categories ?? []}
                  materials={materials}
                  onToggleMaterial={(m) => setMaterials((l) => toggleArray(l, m))}
                  colors={colors}
                  onToggleColor={(c) => setColors((l) => toggleArray(l, c))}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  onMinPrice={setMinPrice}
                  onMaxPrice={setMaxPrice}
                  onPresetPrice={(min, max) => { setMinPrice(String(min)); setMaxPrice(String(max)) }}
                  onClearPrice={() => { setMinPrice(''); setMaxPrice('') }}
                  hasActiveFilters={hasActiveFilters}
                  onClearAll={clearAllFilters}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Sort */}
          <Select value={navSort} onValueChange={(v) => setNavSort(v)}>
            <SelectTrigger size="sm" className="w-[160px] gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border bg-card p-4">
            <FilterPanel
              searchInput={searchInput}
              onSearch={applySearch}
              onSearchInputChange={(v) => setSearchInput(v)}
              navCat={navCat}
              onNavCat={(s) => handleCategoryClick(s)}
              categories={categories ?? []}
              materials={materials}
              onToggleMaterial={(m) => setMaterials((l) => toggleArray(l, m))}
              colors={colors}
              onToggleColor={(c) => setColors((l) => toggleArray(l, c))}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onMinPrice={setMinPrice}
              onMaxPrice={setMaxPrice}
              onPresetPrice={(min, max) => { setMinPrice(String(min)); setMaxPrice(String(max)) }}
              onClearPrice={() => { setMinPrice(''); setMaxPrice('') }}
              hasActiveFilters={hasActiveFilters}
              onClearAll={clearAllFilters}
            />
          </div>
        </aside>

        {/* Product grid */}
        <section>
          {isError ? (
            <ErrorState message={(error as ApiError)?.message || 'Không tải được danh sách sản phẩm'} onRetry={clearAllFilters} />
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {data.totalPages > 1 && (
                <Pagination className="mt-6 justify-center">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (page > 1) goToPage(page - 1) }}
                        className={cn(page <= 1 && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                    {pageItems.map((p, i) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`e-${i}`}>
                          <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">…</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(e) => { e.preventDefault(); goToPage(p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (page < (data.totalPages || 1)) goToPage(page + 1) }}
                        className={cn(page >= (data.totalPages || 1) && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : (
            <EmptyState onClear={clearAllFilters} hasActiveFilters={hasActiveFilters} />
          )}
        </section>
      </div>
    </div>
  )
}

/* ------------------------------- Subviews ------------------------------- */

function FilterPanel(props: {
  searchInput: string
  onSearch: (e: React.FormEvent) => void
  onSearchInputChange: (v: string) => void
  navCat: string | undefined
  onNavCat: (slug: string | undefined) => void
  categories: Category[]
  materials: string[]
  onToggleMaterial: (m: string) => void
  colors: string[]
  onToggleColor: (c: string) => void
  minPrice: string
  maxPrice: string
  onMinPrice: (v: string) => void
  onMaxPrice: (v: string) => void
  onPresetPrice: (min: number, max: number) => void
  onClearPrice: () => void
  hasActiveFilters: boolean
  onClearAll: () => void
}) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <form onSubmit={props.onSearch} className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tìm kiếm</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.searchInput}
            onChange={(e) => props.onSearchInputChange(e.target.value)}
            placeholder="Tên sản phẩm…"
            className="pl-8"
          />
        </div>
        <Button type="submit" size="sm" className="w-full">Tìm kiếm</Button>
      </form>

      <Separator />

      {/* Categories */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Danh mục</Label>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => props.onNavCat(undefined)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition',
                !props.navCat ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/60'
              )}
            >
              Tất cả
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>
          </li>
          {props.categories.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => props.onNavCat(c.slug)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition',
                  props.navCat === c.slug ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/60'
                )}
              >
                <span>{c.name}</span>
                <span className="text-[11px] text-muted-foreground">{c.productCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      {/* Price */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Khoảng giá</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="numeric"
            value={props.minPrice}
            onChange={(e) => props.onMinPrice(e.target.value)}
            placeholder="Từ ₫"
            className="text-sm"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={props.maxPrice}
            onChange={(e) => props.onMaxPrice(e.target.value)}
            placeholder="Đến ₫"
            className="text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => props.onPresetPrice(p.min, p.max)}
              className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
        {(props.minPrice || props.maxPrice) && (
          <button
            type="button"
            onClick={props.onClearPrice}
            className="text-[11px] text-muted-foreground underline hover:text-primary"
          >
            Xóa khoảng giá
          </button>
        )}
      </div>

      <Separator />

      {/* Materials */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chất liệu</Label>
        <div className="space-y-1.5">
          {MATERIAL_OPTIONS.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={props.materials.includes(m)}
                onCheckedChange={() => props.onToggleMaterial(m)}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Colors */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Màu sắc</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {COLOR_OPTIONS.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={props.colors.includes(c)}
                onCheckedChange={() => props.onToggleColor(c)}
              />
              <span
                className="h-3.5 w-3.5 rounded-full border"
                style={{ backgroundColor: COLOR_SWATCH[c] || '#ccc' }}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </div>

      {props.hasActiveFilters && (
        <>
          <Separator />
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={props.onClearAll}>
            <X className="h-3.5 w-3.5" /> Xóa bộ lọc
          </Button>
        </>
      )}
    </div>
  )
}

function EmptyState({ onClear, hasActiveFilters }: { onClear: () => void; hasActiveFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Frown className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">Không tìm thấy sản phẩm</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm sản phẩm khác.
      </p>
      {hasActiveFilters && (
        <Button onClick={onClear} className="mt-4 gap-1.5">
          <X className="h-4 w-4" /> Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <p className="mb-2 text-sm text-destructive">{message}</p>
      <Button onClick={onRetry} variant="outline" size="sm">Thử lại</Button>
    </div>
  )
}

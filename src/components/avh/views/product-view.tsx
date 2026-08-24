'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import {
  Heart, GitCompareArrows, Link2, Facebook, ShoppingCart, Minus, Plus,
  ShieldCheck, Truck, RotateCcw, ChevronRight, Home as HomeIcon, Star,
  MessageSquare, BadgeCheck, Flame, Sparkles, PenLine,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCartStore } from '@/lib/stores/cart-store'
import { useWishlistStore } from '@/lib/stores/wishlist-store'
import { useCompareStore } from '@/lib/stores/compare-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useRecentStore } from '@/lib/stores/recent-store'
import { formatVND, discountPct } from '@/lib/format'
import { StarRating } from '@/components/avh/star-rating'
import { ProductCard, ProductListItem } from '@/components/avh/product-card'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/* ------------------------------ Types ------------------------------ */

interface Media { id: string; url: string; type: string; thumbnail?: string | null; sortOrder: number }
interface Variant {
  id: string; sku: string; color?: string | null; material?: string | null; size?: string | null
  price: number; stock: number
}
interface ReviewImage { url: string }
interface Review {
  id: string
  rating: number
  title?: string
  content: string
  images: string[]
  verified?: boolean
  reply?: string | null
  repliedAt?: string | null
  createdAt: string
  user: { name: string; avatarUrl?: string | null }
}
interface Question {
  id: string
  askerName: string
  question: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
}
interface RatingBucket { star: number; count: number }
interface RelatedItem {
  id: string; name: string; slug: string; basePrice: number
  comparePrice?: number | null; discountPct: number
  rating: number; reviewCount: number; image: string
}

interface ProductDetail {
  id: string
  name: string
  slug: string
  brand?: string
  description?: string
  basePrice: number
  comparePrice?: number | null
  discountPct: number
  rating: number
  reviewCount: number
  soldCount?: number
  isFeatured?: boolean
  isNew?: boolean
  isFlashSale?: boolean
  category: { id: string; slug: string; name: string }
  specs: Record<string, string>
  tags: string[]
  colors: string[]
  materials: string[]
  media: Media[]
  variants: Variant[]
  reviews: Review[]
  questions: Question[]
  ratingDistribution: RatingBucket[]
  related: RelatedItem[]
}

// Hex swatches for common Vietnamese furniture color names
const COLOR_SWATCH: Record<string, string> = {
  'Nâu': '#7b4b2a',
  'Trắng': '#f5f1ea',
  'Đen': '#1c1917',
  'Xám': '#9ca3af',
  'Be': '#d8c4a8',
  'Vàng': '#eab308',
  'Xanh lá': '#4d7c3a',
  'Đỏ': '#b91c1c',
  'Xanh dương': '#1e3a8a',
  'Hồng': '#db2777',
  'Cam': '#ea580c',
  'Tím': '#7c3aed',
}

function colorHex(name?: string | null): string | undefined {
  if (!name) return undefined
  if (name.startsWith('#')) return name
  return COLOR_SWATCH[name]
}

/* ------------------------------ View ------------------------------ */

export function ProductView() {
  const params = useUIStore((s) => s.params)
  const setView = useUIStore((s) => s.setView)
  const openCart = useUIStore((s) => s.openCart)
  const slug = params.slug

  const { data: product, isLoading, isError, error } = useQuery<ProductDetail>({
    queryKey: ['product', slug],
    queryFn: () => api.get(`/api/products/${slug}`),
    enabled: !!slug,
  })

  if (!slug) {
    return <NotFound onBack={() => setView('shop')} />
  }
  if (isLoading) return <ProductSkeleton />
  if (isError || !product) {
    const msg = (error as ApiError)?.message || 'Không tìm thấy sản phẩm'
    return <NotFound onBack={() => setView('shop')} message={msg} />
  }
  return <ProductContent product={product} />
}

function ProductContent({ product }: { product: ProductDetail }) {
  const setView = useUIStore((s) => s.setView)
  const openCart = useUIStore((s) => s.openCart)
  const addItem = useCartStore((s) => s.addItem)
  const wishlist = useWishlistStore()
  const compare = useCompareStore()
  const addRecent = useRecentStore((s) => s.add)
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  // Track recently viewed products (localStorage, no backend needed)
  useEffect(() => {
    if (product?.id) {
      addRecent({
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.media?.[0]?.url || '/products/placeholder.png',
        basePrice: product.basePrice,
      })
    }
  }, [product?.id, addRecent])

  // --- Image gallery state ---
  const [activeMedia, setActiveMedia] = useState(0)

  // --- Variant state ---
  const colorOptions = useMemo(() => unique(product.variants.map((v) => v.color).filter(Boolean)) as string[], [product.variants])
  const materialOptions = useMemo(() => unique(product.variants.map((v) => v.material).filter(Boolean)) as string[], [product.variants])
  const sizeOptions = useMemo(() => unique(product.variants.map((v) => v.size).filter(Boolean)) as string[], [product.variants])

  const [selColor, setSelColor] = useState<string | undefined>(colorOptions[0] || product.colors[0])
  const [selMaterial, setSelMaterial] = useState<string | undefined>(materialOptions[0] || product.materials[0])
  const [selSize, setSelSize] = useState<string | undefined>(sizeOptions[0])

  const selectedVariant = useMemo(() => {
    if (!product.variants.length) return null
    return (
      product.variants.find(
        (v) =>
          (!selColor || v.color === selColor) &&
          (!selMaterial || v.material === selMaterial) &&
          (!selSize || v.size === selSize)
      ) ||
      product.variants.find((v) => (!selColor || v.color === selColor)) ||
      product.variants[0]
    )
  }, [product, selColor, selMaterial, selSize])

  const displayedPrice = selectedVariant?.price ?? product.basePrice
  const displayedStock = selectedVariant?.stock ?? 99
  const outOfStock = displayedStock <= 0

  const [qty, setQty] = useState(1)
  // Reset variant selections + qty + gallery when the product itself changes
  // (navigating from one product detail to another). Uses the React-recommended
  // "adjust state during render" pattern instead of setState-in-effect.
  const [prevProductId, setPrevProductId] = useState(product.id)
  if (product.id !== prevProductId) {
    setPrevProductId(product.id)
    setSelColor(colorOptions[0] || product.colors[0])
    setSelMaterial(materialOptions[0] || product.materials[0])
    setSelSize(sizeOptions[0])
    setQty(1)
    setActiveMedia(0)
  }
  // Reset qty when the selected variant changes (during-render pattern).
  const [prevVariantId, setPrevVariantId] = useState(selectedVariant?.id)
  if (selectedVariant?.id !== prevVariantId) {
    setPrevVariantId(selectedVariant?.id)
    setQty(1)
  }

  // Discount
  const disc = product.discountPct || discountPct(displayedPrice, product.comparePrice)

  // Wishlist/compare state
  const isWishlisted = wishlist.has(product.id)
  const isCompared = compare.productIds.includes(product.id)

  // --- Add to cart ---
  function buildCartLine(quantity: number) {
    return {
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      slug: product.slug,
      image: product.media[0]?.url ?? '/products/placeholder.png',
      color: selectedVariant?.color || selColor || product.colors[0],
      material: selectedVariant?.material || selMaterial || product.materials[0],
      size: selectedVariant?.size || selSize,
      unitPrice: displayedPrice,
      comparePrice: product.comparePrice ?? undefined,
      quantity,
    }
  }

  function handleAddToCart(buyNow = false) {
    if (outOfStock) {
      toast.error('Sản phẩm đã hết hàng')
      return
    }
    const line = buildCartLine(qty)
    addItem(line)
    toast.success(buyNow ? 'Đang chuyển đến thanh toán' : 'Đã thêm vào giỏ hàng', {
      description: `${product.name} × ${qty}`,
    })
    if (buyNow) {
      setView('checkout')
    } else {
      openCart()
    }
  }

  function handleWishlist() {
    wishlist.toggle(product.id)
    toast.success(isWishlisted ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích')
  }

  function handleCompare() {
    if (isCompared) {
      compare.remove(product.id)
      toast.success('Đã bỏ khỏi khay so sánh')
      return
    }
    if (compare.productIds.length >= compare.max) {
      toast.error(`Chỉ so sánh tối đa ${compare.max} sản phẩm`)
      return
    }
    compare.toggle(product.id)
    toast.success('Đã thêm vào khay so sánh')
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Đã sao chép liên kết')
    } catch {
      toast.error('Không thể sao chép liên kết')
    }
  }

  function handleFacebookShare() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600')
    }
  }

  // Related products, normalised to ProductListItem shape
  const relatedAsList: ProductListItem[] = useMemo(
    () => (product.related || []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      basePrice: r.basePrice,
      comparePrice: r.comparePrice,
      discountPct: r.discountPct,
      rating: r.rating,
      reviewCount: r.reviewCount,
      image: r.image,
      inStock: true,
      category: product.category,
    })),
    [product.related, product.category]
  )

  const mainImage = product.media[activeMedia]?.url ?? '/products/placeholder.png'

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => setView('home')}>
              <HomeIcon className="h-3.5 w-3.5" /> Trang chủ
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => setView('shop')}>
              Sản phẩm
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => setView('shop', { cat: product.category.slug })}>
              {product.category.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* ---------------- Gallery ---------------- */}
        <section>
          <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
            <Image
              src={mainImage}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
            {/* badges */}
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {disc > 0 && (
                <Badge className="bg-red-600 text-white shadow">-{disc}%</Badge>
              )}
              {product.isNew && (
                <Badge className="bg-emerald-600 text-white shadow">Mới</Badge>
              )}
              {product.isFlashSale && (
                <Badge className="bg-amber-500 text-white shadow">Flash Sale</Badge>
              )}
              {product.isFeatured && (
                <Badge className="bg-primary text-primary-foreground shadow">Nổi bật</Badge>
              )}
            </div>
            {/* wishlist quick toggle */}
            <button
              onClick={handleWishlist}
              aria-label="Thêm vào yêu thích"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 shadow backdrop-blur transition hover:bg-background"
            >
              <Heart className={cn('h-5 w-5', isWishlisted && 'fill-red-500 text-red-500')} />
            </button>
          </div>

          {/* Thumbnails */}
          {product.media.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
              {product.media.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMedia(i)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-md border-2 bg-muted/40 transition',
                    i === activeMedia ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'
                  )}
                  aria-label={`Ảnh ${i + 1}`}
                >
                  <Image
                    src={m.thumbnail || m.url}
                    alt={`Thumbnail ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Trust highlights */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: ShieldCheck, title: 'Bảo hành', sub: '24-36 tháng' },
              { icon: Truck, title: 'Giao hàng', sub: 'Toàn quốc 2-5 ngày' },
              { icon: RotateCcw, title: 'Đổi trả', sub: '7 ngày' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center">
                <s.icon className="h-5 w-5 text-primary" />
                <p className="text-xs font-semibold">{s.title}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Info ---------------- */}
        <section className="flex flex-col">
          {product.brand && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{product.brand}</p>
          )}
          <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">{product.name}</h1>

          {/* Rating + sold + sku */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <StarRating value={product.rating} size={16} showValue />
            <span className="text-muted-foreground">({product.reviewCount} đánh giá)</span>
            {product.soldCount != null && product.soldCount > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">Đã bán {product.soldCount.toLocaleString('vi-VN')}</span>
              </>
            )}
            {selectedVariant?.sku && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-muted-foreground">SKU: {selectedVariant.sku}</span>
              </>
            )}
          </div>

          {/* Price */}
          <div className="mt-4 rounded-xl bg-accent/50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-3xl font-bold text-primary sm:text-4xl">{formatVND(displayedPrice)}</span>
              {product.comparePrice && product.comparePrice > displayedPrice && (
                <span className="text-base text-muted-foreground line-through">{formatVND(product.comparePrice)}</span>
              )}
              {disc > 0 && (
                <Badge className="bg-red-600 text-white">-{disc}%</Badge>
              )}
            </div>
            {outOfStock ? (
              <p className="mt-2 text-sm font-medium text-destructive">Sản phẩm tạm hết hàng</p>
            ) : displayedStock <= 5 ? (
              <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                Sắp hết hàng — chỉ còn {displayedStock} sản phẩm
              </p>
            ) : (
              <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Còn hàng — sẵn sàng giao</p>
            )}
          </div>

          {/* Variant selectors */}
          {colorOptions.length > 0 && (
            <VariantRow label="Màu sắc">
              {colorOptions.map((c) => {
                const hex = colorHex(c)
                const active = selColor === c
                return (
                  <button
                    key={c}
                    onClick={() => setSelColor(c)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition',
                      active ? 'border-primary bg-accent text-accent-foreground font-medium' : 'hover:border-primary/50'
                    )}
                  >
                    {hex && (
                      <span
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: hex }}
                      />
                    )}
                    {c}
                  </button>
                )
              })}
            </VariantRow>
          )}

          {materialOptions.length > 0 && (
            <VariantRow label="Chất liệu">
              {materialOptions.map((m) => {
                const active = selMaterial === m
                return (
                  <button
                    key={m}
                    onClick={() => setSelMaterial(m)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition',
                      active ? 'border-primary bg-accent text-accent-foreground font-medium' : 'hover:border-primary/50'
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </VariantRow>
          )}

          {sizeOptions.length > 0 && (
            <VariantRow label="Kích thước">
              {sizeOptions.map((s) => {
                const active = selSize === s
                return (
                  <button
                    key={s}
                    onClick={() => setSelSize(s)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs transition',
                      active ? 'border-primary bg-accent text-accent-foreground font-medium' : 'hover:border-primary/50'
                    )}
                  >
                    {s}
                  </button>
                )
              })}
            </VariantRow>
          )}

          {/* Quantity + actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={outOfStock}
                aria-label="Giảm số lượng"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={qty}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(displayedStock, Number(e.target.value) || 1))
                  setQty(n)
                }}
                min={1}
                max={Math.max(1, displayedStock)}
                className="h-9 w-14 rounded-none border-0 text-center"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setQty((q) => Math.min(displayedStock, q + 1))}
                disabled={outOfStock}
                aria-label="Tăng số lượng"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="lg"
              className="flex-1 gap-2 sm:flex-none sm:px-10"
              onClick={() => handleAddToCart(false)}
              disabled={outOfStock}
            >
              <ShoppingCart className="h-5 w-5" /> Thêm vào giỏ
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={() => handleAddToCart(true)}
              disabled={outOfStock}
            >
              Mua ngay
            </Button>
          </div>

          {/* Secondary actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleWishlist}>
              <Heart className={cn('h-4 w-4', isWishlisted && 'fill-red-500 text-red-500')} />
              {isWishlisted ? 'Bỏ yêu thích' : 'Yêu thích'}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCompare}>
              <GitCompareArrows className="h-4 w-4" />
              {isCompared ? 'Bỏ so sánh' : 'So sánh'}
            </Button>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleFacebookShare}>
                    <Facebook className="h-4 w-4" /> Chia sẻ
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chia sẻ lên Facebook</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
              <Link2 className="h-4 w-4" /> Sao chép link
            </Button>
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.slice(0, 8).map((t) => (
                <button
                  key={t}
                  onClick={() => setView('shop', { q: t })}
                  className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] text-accent-foreground transition hover:bg-accent/70"
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Tabs ---------------- */}
      <Tabs defaultValue="description" className="mt-8">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="description" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Mô tả
          </TabsTrigger>
          <TabsTrigger value="specs" className="gap-1.5">
            Thông số
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            Đánh giá <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Hỏi đáp <span className="text-[10px] text-muted-foreground">({product.questions.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Description */}
        <TabsContent value="description" className="mt-4">
          <div className="prose prose-sm max-w-none rounded-xl border bg-card p-5 dark:prose-invert">
            {product.description ? (
              <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {product.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có mô tả cho sản phẩm này.</p>
            )}
          </div>
        </TabsContent>

        {/* Specs */}
        <TabsContent value="specs" className="mt-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            {Object.keys(product.specs || {}).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Chưa có thông số kỹ thuật.</p>
            ) : (
              <ul className="divide-y">
                {Object.entries(product.specs).map(([k, v]) => (
                  <li key={k} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="col-span-2 font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews" className="mt-4">
          <ReviewsTab product={product} />
        </TabsContent>

        {/* Q&A */}
        <TabsContent value="qa" className="mt-4">
          <QnATab product={product} />
        </TabsContent>
      </Tabs>

      {/* ---------------- Related ---------------- */}
      {relatedAsList.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <ChevronRight className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold sm:text-xl">Sản phẩm tương tự</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {relatedAsList.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Sticky mobile add-to-cart ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background/95 p-3 shadow-lg backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">Giá</p>
          <p className="truncate text-base font-bold text-primary">{formatVND(displayedPrice)}</p>
        </div>
        <Button
          size="lg"
          className="flex-1 gap-2"
          onClick={() => handleAddToCart(false)}
          disabled={outOfStock}
        >
          <ShoppingCart className="h-5 w-5" /> {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
        </Button>
      </div>
      {/* spacer for sticky bar on mobile */}
      <div className="h-16 lg:hidden" />
    </div>
  )
}

/* ------------------------------ Variant Row ------------------------------ */

function VariantRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/* ------------------------------ Reviews Tab ------------------------------ */

function ReviewsTab({ product }: { product: ProductDetail }) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = product.ratingDistribution.reduce((n, b) => n + b.count, 0) || product.reviewCount
  const avg = product.rating || 0
  const maxBucket = Math.max(1, ...product.ratingDistribution.map((b) => b.count))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      toast.error('Vui lòng đăng nhập để đánh giá')
      return
    }
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung đánh giá')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/reviews', {
        productId: product.id,
        userId: user.id,
        rating,
        title: title.trim(),
        content: content.trim(),
      })
      toast.success('Cảm ơn bạn đã đánh giá sản phẩm!')
      setTitle('')
      setContent('')
      setRating(5)
      qc.invalidateQueries({ queryKey: ['product', product.slug] })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Gửi đánh giá thất bại'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* Summary + form */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="text-4xl font-bold text-primary">{avg.toFixed(1)}</p>
          <StarRating value={avg} size={18} className="mt-1 justify-center" />
          <p className="mt-1 text-xs text-muted-foreground">{total} đánh giá</p>
        </div>

        {/* Distribution */}
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Phân bố đánh giá</p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const bucket = product.ratingDistribution.find((b) => b.star === star)
              const count = bucket?.count || 0
              const pct = total ? (count / total) * 100 : 0
              const widthPct = total ? (count / maxBucket) * 100 : 0
              return (
                <button
                  key={star}
                  onClick={() => {
                    // visual hint only — no per-star filtering in this demo
                    toast.info(`Lọc theo ${star} sao — tính năng đang phát triển`)
                  }}
                  className="flex w-full items-center gap-2 text-xs"
                >
                  <span className="flex w-10 items-center gap-0.5">
                    {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Submit form */}
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <PenLine className="h-4 w-4 text-primary" /> Viết đánh giá
          </p>
          {user ? (
            <>
              <Label className="mb-1.5 block text-xs">Chọn số sao</Label>
              <div className="mb-3 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    aria-label={`Đánh giá ${s} sao`}
                  >
                    <Star
                      className={cn(
                        'h-7 w-7 transition',
                        s <= rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground'
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating} sao</span>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Tiêu đề (tuỳ chọn)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <Textarea
                  placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  required
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed bg-accent/30 p-4 text-center text-sm">
              <p className="text-muted-foreground">Vui lòng đăng nhập để gửi đánh giá.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  document.querySelector<HTMLButtonElement>('[aria-label="Tài khoản"]')?.click()
                }}
              >
                Đăng nhập ngay
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Review list */}
      <div>
        {product.reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Chưa có đánh giá nào cho sản phẩm này.</p>
            <p className="mt-1 text-xs text-muted-foreground">Hãy là người đầu tiên đánh giá!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {product.reviews.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    {r.user?.avatarUrl ? (
                      <img src={r.user.avatarUrl} alt={r.user.name} className="h-full w-full rounded-full object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">
                      {(r.user?.name || 'K').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{r.user?.name || 'Khách hàng'}</span>
                      {r.verified && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <BadgeCheck className="h-3 w-3 text-emerald-600" /> Đã mua hàng
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRating value={r.rating} size={14} />
                    </div>
                    {r.title && <p className="mt-1.5 text-sm font-semibold">{r.title}</p>}
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{r.content}</p>

                    {r.images?.length > 0 && (
                      <div className="mt-2 grid grid-cols-5 gap-1.5">
                        {r.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`Ảnh đánh giá ${i + 1}`}
                            className="aspect-square w-full rounded-md border object-cover"
                          />
                        ))}
                      </div>
                    )}

                    {r.reply && (
                      <div className="mt-3 rounded-lg border-l-2 border-primary bg-accent/40 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <BadgeCheck className="h-3.5 w-3.5" /> Phản hồi từ AVH
                          {r.repliedAt && (
                            <span className="font-normal text-muted-foreground">
                              · {new Date(r.repliedAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-foreground/90">{r.reply}</p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ Q&A Tab ------------------------------ */

function QnATab({ product }: { product: ProductDetail }) {
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setSubmitting(true)
    // No-op: spec says show toast
    setTimeout(() => {
      setSubmitting(false)
      setQuestion('')
      toast.success('Cảm ơn, chúng tôi sẽ phản hồi sớm')
    }, 400)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Questions list */}
      <div>
        {product.questions.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Chưa có câu hỏi nào. Hãy đặt câu hỏi đầu tiên!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {product.questions.map((q) => (
              <li key={q.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                      {(q.askerName || 'K').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{q.askerName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/90">{q.question}</p>
                    {q.answer && (
                      <div className="mt-3 rounded-lg border-l-2 border-primary bg-accent/40 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <BadgeCheck className="h-3.5 w-3.5" /> Trả lời từ AVH
                          {q.answeredAt && (
                            <span className="font-normal text-muted-foreground">
                              · {new Date(q.answeredAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-foreground/90">{q.answer}</p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ask form */}
      <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" /> Đặt câu hỏi
        </p>
        <Textarea
          placeholder="Nhập câu hỏi của bạn về sản phẩm…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
        />
        <Button type="submit" className="mt-3 w-full" disabled={submitting || !question.trim()}>
          {submitting ? 'Đang gửi…' : 'Gửi câu hỏi'}
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Câu hỏi của bạn sẽ được kiểm duyệt trước khi hiển thị công khai.
        </p>
      </form>
    </div>
  )
}

/* ------------------------------ States ------------------------------ */

function NotFound({ onBack, message }: { onBack: () => void; message?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Flame className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold">Không tìm thấy sản phẩm</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message || 'Sản phẩm có thể đã bị gỡ hoặc không tồn tại.'}</p>
      <Button onClick={onBack} className="mt-4">Quay lại cửa hàng</Button>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <Skeleton className="mb-3 h-4 w-1/2" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Utils ------------------------------ */

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

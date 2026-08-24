'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Tag,
  ArrowRight,
  ArrowLeft,
  Truck,
  ShieldCheck,
  X,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCartStore, type CartLine } from '@/lib/stores/cart-store'
import { api, ApiError } from '@/lib/api'
import { formatVND } from '@/lib/format'
import { ProductCard, type ProductListItem } from '@/components/avh/product-card'

interface VoucherResp {
  code: string
  description: string
  type: string
  value: number
  discount: number
}

const EST_FREE_SHIP_THRESHOLD = 3_000_000
const SUGGESTED_VOUCHERS = ['AVH10', 'AVH200K', 'FREESHIP']

export function CartPageView() {
  const setView = useUIStore((s) => s.setView)
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.subtotal)
  const count = useCartStore((s) => s.count)
  const voucherCode = useCartStore((s) => s.voucherCode)
  const setVoucher = useCartStore((s) => s.setVoucher)

  const [voucherInput, setVoucherInput] = useState('')
  const sub = subtotal()
  const lastTriedCodeRef = useRef<string | null>(null)

  const voucherQuery = useQuery({
    queryKey: ['voucher', voucherCode, sub],
    enabled: !!voucherCode,
    queryFn: () =>
      api.get<VoucherResp>(
        `/api/vouchers?code=${encodeURIComponent(voucherCode!)}&subtotal=${sub}`
      ),
  })

  // Surface toast once after the user clicks "Áp dụng" — either success or
  // error from the server. After this initial feedback we stay silent and
  // rely on the chip + checkout re-validation for ongoing cart changes.
  useEffect(() => {
    if (!voucherCode) return
    if (lastTriedCodeRef.current !== voucherCode) return
    if (voucherQuery.isError) {
      const err = voucherQuery.error
      toast.error(
        err instanceof ApiError ? err.message : 'Mã giảm giá không hợp lệ'
      )
      setVoucher(undefined)
      lastTriedCodeRef.current = null
    } else if (voucherQuery.isSuccess) {
      const v = voucherQuery.data
      if (v) {
        toast.success('Áp dụng mã thành công', {
          description: `${v.description || v.code} · Giảm ${formatVND(
            v.discount
          )}`,
        })
      }
      lastTriedCodeRef.current = null
    }
  }, [
    voucherQuery.isError,
    voucherQuery.isSuccess,
    voucherCode,
    setVoucher,
  ])

  const applyVoucher = () => {
    const code = voucherInput.trim().toUpperCase()
    if (!code) {
      toast.error('Vui lòng nhập mã giảm giá')
      return
    }
    lastTriedCodeRef.current = code
    setVoucher(code)
    setVoucherInput('')
  }

  const removeVoucher = () => {
    setVoucher(undefined)
    lastTriedCodeRef.current = null
    toast.success('Đã bỏ mã giảm giá')
  }

  const voucher = voucherQuery.data
  const discount = voucher?.discount ?? 0
  const estShipping = sub >= EST_FREE_SHIP_THRESHOLD ? 0 : 80000
  const total = Math.max(0, sub + estShipping - discount)

  const { data: suggestedData, isLoading: suggLoading } = useQuery<{
    items: ProductListItem[]
  }>({
    queryKey: ['products', 'cart-suggested'],
    queryFn: () => api.get('/api/products?limit=4&sort=best-selling'),
  })

  // Empty state
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/50 p-10 text-center sm:p-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShoppingCart className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              Giỏ hàng của bạn đang trống
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Khám phá bộ sưu tập nội thất AVH để tìm món đồ yêu thích tiếp theo.
            </p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => setView('shop')}>
            <ArrowRight className="h-4 w-4" />
            Tiếp tục mua sắm
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Giỏ hàng</h1>
          <p className="text-sm text-muted-foreground">
            {count()} sản phẩm · Tạm tính {formatVND(sub)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 self-start sm:self-auto"
          onClick={() => setView('shop')}
        >
          <ArrowLeft className="h-4 w-4" />
          Tiếp tục mua sắm
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Items list */}
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <CartRow
              key={`${item.productId}-${item.variantId ?? 'base'}-${idx}`}
              item={item}
              onQty={(q) =>
                updateQty(item.productId, item.variantId, q)
              }
              onRemove={() => {
                removeItem(item.productId, item.variantId)
                toast.success('Đã xoá sản phẩm khỏi giỏ')
              }}
              onNavigate={() => setView('product', { slug: item.slug })}
            />
          ))}

          {/* Voucher card */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Mã giảm giá</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyVoucher()
                  }}
                  placeholder="Nhập mã giảm giá (VD: AVH10)"
                  className="h-10 pl-3"
                />
              </div>
              <Button
                onClick={applyVoucher}
                disabled={!voucherInput.trim()}
                className="gap-1"
              >
                <Tag className="h-4 w-4" />
                Áp dụng
              </Button>
            </div>

            {voucherCode && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium leading-tight">{voucherCode}</p>
                    {voucher && (
                      <p className="text-[11px] text-muted-foreground">
                        {voucher.description} · Giảm{' '}
                        {formatVND(voucher.discount)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={removeVoucher}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Bỏ mã giảm giá"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="mt-2 text-[11px] text-muted-foreground">
              Gợi ý:{' '}
              {SUGGESTED_VOUCHERS.map((c, i) => (
                <span key={c}>
                  <button
                    type="button"
                    onClick={() => setVoucherInput(c)}
                    className="font-mono text-primary underline-offset-2 hover:underline"
                  >
                    {c}
                  </button>
                  {i < SUGGESTED_VOUCHERS.length - 1 && ', '}
                </span>
              ))}
            </p>
          </Card>
        </div>

        {/* Summary sidebar */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Tóm tắt đơn hàng</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(sub)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá ({voucherCode})</span>
                  <span>-{formatVND(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển (ước tính)</span>
                <span>
                  {estShipping === 0 ? (
                    <span className="text-emerald-600">Miễn phí</span>
                  ) : (
                    formatVND(estShipping)
                  )}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Miễn phí ship cho đơn hàng trên 3.000.000₫. Phí cuối cùng được
                tính chính xác ở bước thanh toán.
              </p>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Tổng cộng (ước tính)</span>
                <span className="text-primary">{formatVND(total)}</span>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-4 w-full gap-2"
              onClick={() => setView('checkout')}
            >
              Tiến hành thanh toán
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full gap-1"
              onClick={() => setView('shop')}
            >
              Tiếp tục mua sắm
            </Button>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Giao toàn quốc
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Bảo hành 24-36T
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Đổi trả 7 ngày
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Voucher tích lũy
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Suggested products */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Có thể bạn cũng thích</h2>
            <p className="text-xs text-muted-foreground">
              Sản phẩm bán chạy nhất tại AVH
            </p>
          </div>
          <Button
            variant="link"
            size="sm"
            className="gap-1"
            onClick={() => setView('shop')}
          >
            Xem tất cả
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {suggLoading || !suggestedData?.items
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-xl" />
              ))
            : suggestedData.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
        </div>
      </section>
    </div>
  )
}

function CartRow({
  item,
  onQty,
  onRemove,
  onNavigate,
}: {
  item: CartLine
  onQty: (q: number) => void
  onRemove: () => void
  onNavigate: () => void
}) {
  const lineTotal = item.unitPrice * item.quantity
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        <button
          onClick={onNavigate}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:h-24 sm:w-24"
          aria-label={item.name}
        >
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="96px"
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </button>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={onNavigate}
              className="line-clamp-2 text-left text-sm font-medium hover:text-primary sm:text-base"
            >
              {item.name}
            </button>
            <button
              onClick={onRemove}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label="Xoá sản phẩm"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
            {item.color && <span>Màu: {item.color}</span>}
            {item.material && <span>· Chất liệu: {item.material}</span>}
            {item.size && <span>· Kích thước: {item.size}</span>}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            {/* Qty selector */}
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => onQty(item.quantity - 1)}
                className="p-1.5 hover:bg-accent"
                aria-label="Giảm số lượng"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                aria-label="Số lượng"
                value={item.quantity}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!Number.isNaN(n)) onQty(Math.max(1, n))
                }}
                className="w-10 border-x bg-transparent text-center text-sm outline-none"
              />
              <button
                onClick={() => onQty(item.quantity + 1)}
                className="p-1.5 hover:bg-accent"
                aria-label="Tăng số lượng"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Price */}
            <div className="text-right">
              <p className="text-sm font-semibold text-primary sm:text-base">
                {formatVND(lineTotal)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatVND(item.unitPrice)} / sản phẩm
              </p>
              {item.comparePrice &&
                item.comparePrice > item.unitPrice && (
                  <p className="text-[10px] text-muted-foreground line-through">
                    {formatVND(item.comparePrice * item.quantity)}
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

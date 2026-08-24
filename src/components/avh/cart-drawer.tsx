import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, X, Tag, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCartStore } from '@/lib/stores/cart-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useMounted } from '@/hooks/use-mounted'
import { formatVND } from '@/lib/format'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function CartDrawer() {
  const cartOpen = useUIStore((s) => s.cartOpen)
  const closeCart = useUIStore((s) => s.closeCart)
  const setView = useUIStore((s) => s.setView)
  const user = useAuthStore((s) => s.user)
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.subtotal)
  const voucherCode = useCartStore((s) => s.voucherCode)
  const setVoucher = useCartStore((s) => s.setVoucher)
  const [voucherInput, setVoucherInput] = useState('')
  const mounted = useMounted()
  

  const voucher = useQuery({
    queryKey: ['voucher', voucherCode, subtotal()],
    queryFn: async () => {
      if (!voucherCode) return null
      try {
        return await api.get<{ code: string; description: string; discount: number }>(
          `/api/vouchers?code=${voucherCode}&subtotal=${subtotal()}`
        )
      } catch {
        return null
      }
    },
    enabled: !!voucherCode,
  })

  const discount = voucher.data?.discount || 0
  const total = Math.max(0, subtotal() - discount)

  // Validate cart items — fetch all product IDs to detect recalled/deleted products.
  // If a cart item's productId no longer exists in the DB, show a "đã thu hồi" badge.
  const { data: validProducts } = useQuery<{ items: Array<{ id: string; inStock?: boolean }> }>({
    queryKey: ['cart-validation'],
    queryFn: () => api.get('/api/products?limit=60'),
  })
  const validIds = new Set(validProducts?.items?.map((p) => p.id) || [])
  const recalledItems = items.filter((i) => !validIds.has(i.productId))
  const hasRecalled = recalledItems.length > 0

  const applyVoucher = () => {
    if (!voucherInput.trim()) return
    setVoucher(voucherInput.trim().toUpperCase())
    toast.success('Đã áp dụng mã giảm giá')
  }

  const handleCheckout = () => {
    if (hasRecalled) {
      toast.error('Giỏ hàng có sản phẩm đã bị thu hồi. Vui lòng xoá trước khi thanh toán.')
      return
    }
    // Require login before checkout — guests must register/login first.
    // The order API also enforces this server-side (requires Bearer token),
    // so even bypassing the UI won't let a guest create an order.
    if (!user) {
      toast.info('Vui lòng đăng nhập để thanh toán', {
        description: 'Đơn hàng sẽ được lưu vào tài khoản của bạn để theo dõi.',
      })
      closeCart()
      setView('account')
      return
    }
    closeCart()
    setView('checkout')
  }

  return (
    <Sheet open={cartOpen} onOpenChange={(v) => !v && closeCart()}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3.5">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Giỏ hàng ({mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0})
          </SheetTitle>
          <SheetClose className="rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Đóng">
            <X className="h-5 w-5" />
          </SheetClose>
        </SheetHeader>

        {!mounted ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Giỏ hàng trống</p>
              <p className="text-sm text-muted-foreground">Hãy thêm món nội thất bạn yêu thích</p>
            </div>
            <Button
              onClick={() => {
                closeCart()
                setView('shop')
              }}
            >
              Tiếp tục mua sắm
            </Button>
          </div>
        ) : (
          <>
            {/* Items list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {items.map((item, idx) => {
                const isRecalled = !validIds.has(item.productId)
                return (
                <div key={`${item.productId}-${item.variantId}-${idx}`} className={`flex gap-3 border-b py-3 last:border-0 ${isRecalled ? 'opacity-60' : ''}`}>
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => {
                          closeCart()
                          setView('product', { slug: item.slug })
                        }}
                        className="line-clamp-2 text-left text-sm font-medium hover:text-primary"
                      >
                        {item.name}
                      </button>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {isRecalled && (
                      <div className="mt-1 flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Sản phẩm đã bị thu hồi
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {item.color && (
                        <span className="text-[11px] text-muted-foreground">Màu: {item.color}</span>
                      )}
                      {item.material && (
                        <span className="text-[11px] text-muted-foreground">· {item.material}</span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <div className="flex items-center rounded-md border">
                        <button
                          onClick={() => updateQty(item.productId, item.variantId, item.quantity - 1)}
                          className="p-1.5 hover:bg-accent"
                          aria-label="Giảm"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, item.variantId, item.quantity + 1)}
                          className="p-1.5 hover:bg-accent"
                          aria-label="Tăng"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">{formatVND(item.unitPrice * item.quantity)}</p>
                        {item.comparePrice && item.comparePrice > item.unitPrice && (
                          <p className="text-[11px] text-muted-foreground line-through">
                            {formatVND(item.comparePrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
              })}
            </div>

            {/* Voucher + totals */}
            <div className="border-t px-4 py-3">
              <div className="mb-3 flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    placeholder="Mã giảm giá"
                    className="h-9 pl-8"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={applyVoucher}>
                  Áp dụng
                </Button>
              </div>
              {voucherCode && (
                <div className="mb-2 flex items-center justify-between rounded bg-accent/50 px-2 py-1 text-xs">
                  <span>Đã áp dụng: <strong>{voucherCode}</strong></span>
                  <button onClick={() => setVoucher(undefined)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span>{formatVND(subtotal())}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Giảm giá</span>
                    <span>-{formatVND(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Phí ship</span>
                  <span className="text-xs">Tính ở bước thanh toán</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Tổng cộng</span>
                  <span className="text-primary">{formatVND(total)}</span>
                </div>
              </div>

              <Button className="mt-3 w-full" size="lg" onClick={handleCheckout}>
                Tiến hành thanh toán
              </Button>
              <Button
                variant="ghost"
                className="mt-1 w-full text-xs"
                onClick={() => {
                  closeCart()
                  setView('cart')
                }}
              >
                Xem giỏ hàng chi tiết
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Gợi ý mã: <code className="font-mono">AVH10</code>, <code className="font-mono">AVH200K</code>, <code className="font-mono">FREESHIP</code>
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

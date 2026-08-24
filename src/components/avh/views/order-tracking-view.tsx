'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCartStore } from '@/lib/stores/cart-store'
import {
  formatVND,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  Search,
  Package,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Headphones,
  Home,
  RefreshCcw,
  CalendarClock,
  Wrench,
  Package2,
  Receipt,
  User,
  Phone,
  ArrowRight,
} from 'lucide-react'

interface OrderItem {
  id: string
  name: string
  image: string
  unitPrice: number
  quantity: number
}

interface OrderTimelineEntry {
  status: string
  at: string
  note?: string
}

interface Order {
  id: string
  code: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  shippingFee: number
  discount: number
  total: number
  voucherCode?: string | null
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note?: string | null
  needsInstallation: boolean
  scheduledDate?: string | null
  timeline: OrderTimelineEntry[]
  items: OrderItem[]
  createdAt: string
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40',
  PROCESSING: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-300/40',
  SHIPPING: 'bg-primary/15 text-primary border-primary/30',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/40',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300/40',
  REFUNDED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/40',
}

// Map order status to the 4-step timeline index
function statusToStep(status: string): number {
  switch (status) {
    case 'PENDING':
      return 1 // Đã đặt
    case 'PROCESSING':
      return 2 // Đang xử lý
    case 'SHIPPING':
      return 3 // Đang giao
    case 'DELIVERED':
      return 4 // Đã giao
    default:
      return -1 // CANCELLED / REFUNDED / unknown
  }
}

const STEPS = [
  { label: 'Đã đặt', icon: Package },
  { label: 'Đang xử lý', icon: Clock },
  { label: 'Đang giao', icon: Truck },
  { label: 'Đã giao', icon: CheckCircle2 },
]

export function OrderTrackingView() {
  const params = useUIStore((s) => s.params)
  const code = params.code?.trim()

  if (!code) {
    return <OrderSearchForm />
  }

  return <OrderDetail code={code} />
}

/* ---------------- Search form (no code yet or 404) ---------------- */

function OrderSearchForm({
  initialError,
  defaultValue,
}: {
  initialError?: string
  defaultValue?: string
}) {
  const setView = useUIStore((s) => s.setView)
  const [value, setValue] = useState(defaultValue ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim().toUpperCase()
    if (!v) {
      toast.error('Vui lòng nhập mã đơn hàng')
      return
    }
    setView('order-tracking', { code: v })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center sm:py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Package2 className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">Tra cứu đơn hàng</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Nhập mã đơn hàng (bắt đầu bằng <span className="font-mono font-semibold">AVH-</span>) để theo
        dõi trạng thái và chi tiết đơn của bạn.
      </p>

      <form onSubmit={submit} className="mt-6 flex w-full gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="VD: AVH-ABC123"
            className="pl-9 font-mono uppercase"
            autoFocus
          />
        </div>
        <Button type="submit" className="gap-1.5">
          Tra cứu <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {initialError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {initialError}
        </p>
      )}

      <Button
        variant="link"
        size="sm"
        className="mt-4 text-muted-foreground"
        onClick={() => setView('home')}
      >
        Về trang chủ
      </Button>
    </div>
  )
}

/* ---------------- Order detail ---------------- */

function OrderDetail({ code }: { code: string }) {
  const setView = useUIStore((s) => s.setView)
  const addItem = useCartStore((s) => s.addItem)

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: ['order', code],
    queryFn: () => api.get(`/api/orders/${encodeURIComponent(code)}`),
    staleTime: 30 * 1000,
  })

  if (isLoading) return <OrderSkeleton />
  if (error) {
    const is404 = (error as ApiError).status === 404
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-5 flex flex-col items-center gap-2 rounded-xl border border-red-300/40 bg-red-50/50 px-4 py-6 text-center dark:bg-red-950/20">
          <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          <p className="font-bold text-red-700 dark:text-red-300">
            {is404 ? 'Không tìm thấy đơn hàng' : 'Có lỗi xảy ra'}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {is404
              ? `Không có đơn hàng nào khớp với mã "${code}". Vui lòng kiểm tra lại.`
              : (error as ApiError).message}
          </p>
        </div>
        <OrderSearchForm defaultValue={code} />
      </div>
    )
  }
  if (!order) return null

  const step = statusToStep(order.status)
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED'

  // Re-buy: push all items to cart
  const handleRebuy = () => {
    if (!order.items.length) {
      toast.error('Không có sản phẩm để mua lại')
      return
    }
    for (const it of order.items) {
      addItem({
        productId: it.id,
        name: it.name,
        slug: '', // slug not stored on order items; cart will still work for visual purposes
        image: it.image,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      })
    }
    toast.success('Đã thêm sản phẩm vào giỏ', {
      description: `${order.items.length} sản phẩm từ đơn ${order.code}`,
    })
    setView('checkout')
  }

  const handleContact = () => {
    useUIStore.getState().openChat()
  }

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Theo dõi đơn hàng
          </p>
          <h1 className="font-mono text-2xl font-bold text-primary sm:text-3xl">
            {order.code}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Đặt ngày{' '}
            {new Date(order.createdAt).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge
            variant="outline"
            className={`px-3 py-1 text-sm ${STATUS_BADGE_CLASS[order.status] || ''}`}
          >
            {ORDER_STATUS_LABELS[order.status] || order.status}
          </Badge>
          <p className="text-lg font-bold text-primary">
            {formatVND(order.total)}
          </p>
        </div>
      </div>

      {/* Installation / scheduled-date badges */}
      {(order.needsInstallation || order.scheduledDate) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {order.needsInstallation && (
            <Badge className="gap-1 bg-primary/15 text-primary">
              <Wrench className="h-3 w-3" /> Có lắp đặt tận nơi
            </Badge>
          )}
          {order.scheduledDate && (
            <Badge variant="secondary" className="gap-1">
              <CalendarClock className="h-3 w-3" /> Hẹn giao:{' '}
              {new Date(order.scheduledDate).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </Badge>
          )}
        </div>
      )}

      {/* Timeline stepper */}
      <Card className="mb-4 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {isCancelled ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                <XCircle className="h-7 w-7" />
              </div>
              <p className="font-semibold text-red-700 dark:text-red-300">
                Đơn hàng {ORDER_STATUS_LABELS[order.status]}
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Đơn hàng đã bị huỷ hoặc hoàn tiền. Vui lòng liên hệ hỗ trợ nếu
                bạn cần thêm thông tin.
              </p>
            </div>
          ) : (
            <TimelineStepper currentStep={step} />
          )}
        </CardContent>
      </Card>

      {/* Timeline detail list */}
      {order.timeline?.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" /> Lịch sử trạng thái
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="relative ml-3 space-y-4 border-l border-border pl-5">
              {order.timeline.map((entry, i) => {
                const cancelled = entry.status === 'CANCELLED' || entry.status === 'REFUNDED'
                const isLast = i === order.timeline.length - 1
                return (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[26px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-background ${
                        cancelled
                          ? 'bg-red-500'
                          : isLast
                          ? 'bg-primary'
                          : 'bg-muted-foreground/40'
                      }`}
                    />
                    <p className="text-sm font-semibold">
                      {ORDER_STATUS_LABELS[entry.status] || entry.status}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {entry.at
                        ? new Date(entry.at).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                    {entry.note && (
                      <p className="mt-0.5 text-xs text-foreground/80">
                        {entry.note}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Shipping info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" /> Thông tin giao hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{order.shippingName}</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`tel:${order.shippingPhone}`}
                  className="text-primary hover:underline"
                >
                  {order.shippingPhone}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-foreground/90">
                  {order.shippingAddress}
                </span>
              </div>
              {order.note && (
                <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  <span className="font-semibold">Ghi chú:</span> {order.note}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-primary" /> Thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phương thức</span>
                <span className="font-medium text-right">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                    order.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge
                  variant="outline"
                  className={
                    order.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/40'
                      : order.paymentStatus === 'REFUNDED'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/40'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40'
                  }
                >
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] ||
                    order.paymentStatus}
                </Badge>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Phí giao hàng</span>
                <span>
                  {order.shippingFee === 0
                    ? 'Miễn phí'
                    : formatVND(order.shippingFee)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}
                  </span>
                  <span className="text-emerald-600">
                    -{formatVND(order.discount)}
                  </span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Tổng cộng</span>
                <span className="text-primary text-lg">
                  {formatVND(order.total)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" /> Sản phẩm trong đơn (
            {order.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-border/70">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-3 py-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={it.image}
                    alt={it.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{it.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Đơn giá: {formatVND(it.unitPrice)} · SL: {it.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">
                    {formatVND(it.unitPrice * it.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="default"
          className="gap-1.5"
          onClick={handleRebuy}
          disabled={order.items.length === 0 || isCancelled}
        >
          <RefreshCcw className="h-4 w-4" /> Mua lại
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={handleContact}
        >
          <Headphones className="h-4 w-4" /> Liên hệ hỗ trợ
        </Button>
        <Button
          variant="ghost"
          className="gap-1.5"
          onClick={() => setView('home')}
        >
          <Home className="h-4 w-4" /> Về trang chủ
        </Button>
      </div>
    </div>
  )
}

/* ---------------- Timeline stepper ---------------- */

function TimelineStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isLast = i === STEPS.length - 1
        const Icon = s.icon
        return (
          <div
            key={s.label}
            className={`relative flex flex-1 flex-col items-center ${isLast ? 'flex-none' : ''}`}
          >
            <div className="flex w-full items-center">
              {/* connector left (skip first) */}
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 ${
                    stepNum <= currentStep ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              {/* circle */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isDone
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              {/* connector right (skip last) */}
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 ${
                    stepNum < currentStep ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
            <span
              className={`mt-1.5 text-center text-[11px] font-medium sm:text-xs ${
                isDone || isCurrent
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Loading skeleton ---------------- */

function OrderSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <Skeleton className="mb-4 h-28 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-64 w-full rounded-xl" />
    </div>
  )
}

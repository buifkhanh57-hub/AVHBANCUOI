'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  Home as HomeIcon,
  MapPin,
  Calendar,
  ShieldCheck,
  Gift,
  Sparkles,
  Loader2,
  ShoppingBag,
  Clock,
  CreditCard,
  UploadCloud,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { api, ApiError } from '@/lib/api'
import {
  formatVND,
  PAYMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface OrderDetail {
  id: string
  code: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  shippingFee: number
  discount: number
  total: number
  voucherCode: string | null
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note: string | null
  needsInstallation: boolean
  scheduledDate: string | null
  slipUrl: string | null
  timeline: Array<{ status: string; at: string; note?: string }>
  items: Array<{
    id: string
    name: string
    image: string
    unitPrice: number
    quantity: number
  }>
  createdAt: string
}

const TIMELINE_STAGES = [
  { status: 'PENDING', label: 'Chờ xác nhận', desc: 'Đơn đã được tiếp nhận' },
  { status: 'PROCESSING', label: 'Đang xử lý', desc: 'AVH đang chuẩn bị hàng' },
  { status: 'SHIPPING', label: 'Đang giao', desc: 'Đơn đang trên đường tới bạn' },
  { status: 'DELIVERED', label: 'Đã giao', desc: 'Giao thành công' },
]

export function OrderSuccessView() {
  const setView = useUIStore((s) => s.setView)
  const orderCode = useUIStore((s) => s.params.orderCode)

  const {
    data: order,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['order', orderCode],
    enabled: !!orderCode,
    queryFn: () => api.get<OrderDetail>(`/api/orders/${orderCode}`),
  })

  // No orderCode param — fallback acknowledgement
  if (!orderCode) {
    return <FallbackNotice onShop={() => setView('shop')} onHome={() => setView('home')} />
  }

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-10">
      {/* Hero success */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-14 w-14" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400/30" />
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Đặt hàng thành công!
        </h1>
        <p className="text-sm text-muted-foreground">
          Cảm ơn bạn đã đặt hàng tại Nội Thất AVH. Chúng tôi sẽ liên hệ xác nhận
          trong 30 phút.
        </p>
        <div className="rounded-full bg-accent px-4 py-1.5 text-sm">
          <span className="text-muted-foreground">Mã đơn: </span>
          <span className="font-semibold text-accent-foreground">
            {orderCode}
          </span>
        </div>
      </div>

      {/* Loading / Error / Detail */}
      <div className="mt-8">
        {isLoading ? (
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải thông tin đơn hàng...
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </Card>
        ) : isError ? (
          <Card className="p-5">
            <p className="text-sm text-destructive">
              {error instanceof ApiError
                ? error.message
                : 'Không tải được chi tiết đơn hàng.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1"
              onClick={() => setView('order-tracking', { code: orderCode })}
            >
              Thử theo dõi đơn
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        ) : order ? (
          <SuccessDetail order={order} setView={setView} />
        ) : null}
      </div>
    </div>
  )
}

function SuccessDetail({
  order,
  setView,
}: {
  order: OrderDetail
  setView: ReturnType<typeof useUIStore.getState>['setView']
}) {
  const currentStatus = order.status || 'PENDING'
  const currentIndex = Math.max(
    0,
    TIMELINE_STAGES.findIndex((s) => s.status === currentStatus)
  )

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Summary card */}
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Left: totals */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-primary" />
              Chi tiết đơn hàng
            </h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span>
                  {order.shippingFee === 0 ? (
                    <span className="text-emerald-600">Miễn phí</span>
                  ) : (
                    formatVND(order.shippingFee)
                  )}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá {order.voucherCode && `(${order.voucherCode})`}</span>
                  <span>-{formatVND(order.discount)}</span>
                </div>
              )}
              <Separator className="my-1.5" />
              <div className="flex justify-between text-base font-semibold">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(order.total)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                      order.paymentMethod}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Trạng thái thanh toán:{' '}
                    {order.paymentStatus === 'PAID'
                      ? 'Đã thanh toán'
                      : 'Thanh toán khi nhận hàng'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Dự kiến giao 3-5 ngày làm việc</p>
                  {order.scheduledDate && (
                    <p className="text-xs text-muted-foreground">
                      Hẹn giao:{' '}
                      {new Date(order.scheduledDate).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                  {order.needsInstallation && (
                    <p className="text-xs text-emerald-600">
                      Có lắp đặt tận nơi
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: shipping address */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Địa chỉ giao hàng
            </h2>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {order.shippingName} · {order.shippingPhone}
              </p>
              <p className="mt-1 text-muted-foreground">
                {order.shippingAddress}
              </p>
              {order.note && (
                <p className="mt-1.5 text-xs italic text-muted-foreground">
                  Ghi chú: {order.note}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <Separator className="my-4" />
        <div className="space-y-3">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={it.image}
                  alt={it.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {it.quantity}
                </span>
              </div>
              <p className="line-clamp-2 flex-1 text-sm">{it.name}</p>
              <p className="shrink-0 text-sm font-medium text-primary">
                {formatVND(it.unitPrice * it.quantity)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Slip upload for BANK transfer — only when payment method is BANK */}
      {order.paymentMethod === 'BANK' && (
        <SlipUploader orderCode={order.code} initialSlipUrl={order.slipUrl} />
      )}

      {/* Timeline */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            Tiến trình đơn hàng
          </h2>
          <Badge className="bg-accent text-accent-foreground">
            {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
          </Badge>
        </div>
        <ol className="relative space-y-5 border-l border-border pl-6">
          {TIMELINE_STAGES.map((stage, idx) => {
            const reached = idx <= currentIndex
            const isCurrent = idx === currentIndex
            return (
              <li key={stage.status} className="relative">
                <span
                  className={[
                    'absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px]',
                    reached
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                    isCurrent ? 'ring-4 ring-primary/20' : '',
                  ].join(' ')}
                >
                  {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <p
                  className={[
                    'text-sm font-medium',
                    isCurrent ? 'text-primary' : 'text-foreground',
                  ].join(' ')}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground">{stage.desc}</p>
                {isCurrent && order.timeline?.[0]?.at && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Cập nhật:{' '}
                    {new Date(order.timeline[0].at).toLocaleString('vi-VN')}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </Card>

      {/* CTAs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          size="lg"
          className="gap-2"
          onClick={() => setView('order-tracking', { code: order.code })}
        >
          <Truck className="h-4 w-4" />
          Theo dõi đơn hàng
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={() => setView('shop')}
        >
          <ShoppingBag className="h-4 w-4" />
          Tiếp tục mua sắm
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="gap-2"
          onClick={() => setView('home')}
        >
          <HomeIcon className="h-4 w-4" />
          Về trang chủ
        </Button>
      </div>

      {/* Loyalty + social */}
      <Card className="flex flex-col gap-3 bg-accent/40 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              Tích điểm thành viên · Nhận ưu đãi
            </p>
            <p className="text-xs text-muted-foreground">
              Đăng ký tài khoản AVH để tích lũy điểm với mỗi đơn và đổi voucher
              giảm giá.
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setView('account')}
          >
            <Sparkles className="h-4 w-4" />
            Tham gia hội thành viên
          </Button>
        </div>
      </Card>

      {/* Reassurance */}
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
        <div className="flex flex-col items-center gap-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Bảo hành 24-36 tháng
        </div>
        <div className="flex flex-col items-center gap-1">
          <Truck className="h-5 w-5 text-primary" />
          Giao toàn quốc
        </div>
        <div className="flex flex-col items-center gap-1">
          <Package className="h-5 w-5 text-primary" />
          Đổi trả trong 7 ngày
        </div>
      </div>
    </div>
  )
}

function FallbackNotice({
  onShop,
  onHome,
}: {
  onShop: () => void
  onHome: () => void
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/50 p-10 text-center sm:p-16">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            Đơn hàng của bạn đã được ghi nhận
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nếu có thắc mắc, vui lòng liên hệ hotline AVH hoặc theo dõi qua mã
            đơn trong email xác nhận.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onHome} variant="outline" className="gap-1">
            <HomeIcon className="h-4 w-4" />
            Về trang chủ
          </Button>
          <Button onClick={onShop} className="gap-1">
            Tiếp tục mua sắm
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Slip uploader — lets the customer upload a transfer-slip image after
 * placing a BANK-payment order. POSTs to /api/orders/[code]/slip.
 * ------------------------------------------------------------------------- */
function SlipUploader({
  orderCode,
  initialSlipUrl,
}: {
  orderCode: string
  initialSlipUrl?: string | null
}) {
  const [slipUrl, setSlipUrl] = useState<string | null>(initialSlipUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (JPG/PNG/WebP)')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh quá lớn (tối đa 8MB)')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/orders/${orderCode}/slip`, {
        method: 'POST',
        body: fd,
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Upload thất bại')
      }
      setSlipUrl(body.data.url)
      toast.success('Đã tải lên biên lai. Staff sẽ xác nhận trong 1-30 phút.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Xác nhận chuyển khoản
      </h2>
      {slipUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Đã tải lên biên lai chuyển khoản
              </p>
              <p className="text-xs text-muted-foreground">
                Staff đang kiểm tra. Đơn sẽ tự động chuyển sang "Đang xử lý" sau khi xác nhận.
              </p>
            </div>
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-white">
              <img src={slipUrl} alt="Biên lai" className="h-full w-full object-cover" />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs"
          >
            Tải lên lại biên lai khác
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Vui lòng tải lên ảnh chụp màn hình / ảnh biên lai chuyển khoản để chúng tôi xác nhận
            thanh toán nhanh (trong giờ làm việc).
          </p>
          <div
            onClick={() => !uploading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition hover:border-primary/50 hover:bg-accent/40"
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Đang tải lên…</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Bấm để chọn ảnh biên lai</p>
                <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP — tối đa 8MB</p>
              </>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
          e.target.value = ''
        }}
      />
    </Card>
  )
}

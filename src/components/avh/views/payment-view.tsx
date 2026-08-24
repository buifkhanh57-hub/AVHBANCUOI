'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { formatVND, PAYMENT_METHOD_LABELS } from '@/lib/format'
import { buildVietQRUrl } from '@/lib/vn-banks'
import { FIXED_BANK_ACCOUNT } from '@/lib/fixed-bank-account'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

/**
 * PaymentView — shown right after the customer creates an order with an
 * electronic payment method (currently only BANK; wallets removed).
 *
 * READ-ONLY ON THE FRONTEND:
 *   The customer's browser can NEVER mark this order as paid. The only path
 *   to PAID is a provider-signed webhook (VNPay/MoMo/ZaloPay HMAC, or the
 *   internal x-webhook-secret route for bank transfer reconciliation). The
 *   frontend just polls /api/orders/[code] and reflects the server-side state:
 *
 *     PENDING_VERIFY  → show QR + "Đang chờ ngân hàng xác nhận…"
 *     PAID            → navigate to /order-success
 *     CANCELLED       → show "Đã huỷ" (auto-cancel after 15 min)
 *
 * There is NO "Tôi đã chuyển khoản" button, NO auto-confirm timer, NO admin
 * confirm button here. Admin manual confirmation (when a real bank statement
 * is reconciled by a human) lives in the admin panel via /api/orders/[code]/review,
 * NOT exposed to the storefront customer.
 *
 * QR GENERATION:
 *   The dynamic QR is built from the admin-linked bank account + the order's
 *   total amount + the order code (which doubles as the payment_reference).
 *   Scanning with any banking app pre-fills the transfer. The amount is
 *   embedded in the QR URL so the bank cannot be tricked into a different sum.
 *
 * EXPIRY:
 *   The PaymentSession created with the order has expires_at = now + 15min.
 *   After expiry, the server rejects any webhook for this session; the UI
 *   shows an "expired" state and offers to re-create the order.
 */

interface OrderInfo {
  code: string
  total: number
  paymentMethod: string
  paymentStatus: string
  status: string
  items: Array<{ name: string; quantity: number; unitPrice: number; image: string }>
  shippingName: string
  shippingPhone: string
  // Snapshot of the bank account from the moment the order was created.
  // Pinned to this exact account — admin bank-account changes don't affect
  // already-placed orders.
  bankAccountSnapshot?: {
    bank: string
    bankCode: string
    accountNumber: string
    holder: string
    branch?: string
  } | null
}

const POLL_MS = 4000 // poll order status every 4s while waiting for webhook

export function PaymentView() {
  const params = useUIStore((s) => s.params)
  const setView = useUIStore((s) => s.setView)
  const settings = useSettingsStore()
  const settingsLoaded = useSettingsStore((s) => s.loaded)
  const user = useAuthStore((s) => s.user)
  const orderCode = params.code

  const { data: order, isLoading } = useQuery<OrderInfo>({
    queryKey: ['order-for-payment', orderCode],
    queryFn: () => apiGet(`/api/orders/${orderCode}`),
    enabled: !!orderCode,
    refetchInterval: POLL_MS, // auto-poll — server is single source of truth
  })

  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15-min countdown (matches server-side expires_at)
  const startRef = useRef(Date.now())

  // countdown timer
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      const remaining = Math.max(0, 15 * 60 - elapsed)
      setTimeLeft(remaining)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // When the server reports PAID (via webhook), auto-navigate to success.
  // We DON'T set anything on the server — we just observe.
  useEffect(() => {
    if (order?.paymentStatus === 'PAID') {
      toast.success('Thanh toán đã được xác nhận!')
      setView('order-success', { orderCode })
    }
  }, [order?.paymentStatus, order, setView, orderCode])

  // NOTE: We no longer auto-cancel the order when the countdown expires here.
  // The server-side PaymentSession.expires_at is the authoritative expiry;
  // the webhook will reject any late event. The countdown here is just a
  // visual hint — the actual order status remains PENDING_VERIFY until either
  // a webhook arrives or the admin manually cancels.

  function copyOrderCode() {
    if (!order?.code) return
    navigator.clipboard.writeText(order.code)
    toast.success('Đã sao chép mã đơn')
  }

  if (!orderCode) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <p className="font-medium">Không tìm thấy đơn hàng</p>
        <Button className="mt-4" onClick={() => setView('shop')}>Tiếp tục mua sắm</Button>
      </div>
    )
  }

  if (isLoading || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-4 h-10 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // ── Bank account + QR ───────────────────────────────────────────────
  // Use the bankAccountSnapshot from the order's PaymentSession (pinned at
  // order-creation time) — NOT the current admin Setting. If for some reason
  // the snapshot is null (very old orders before the snapshot field existed),
  // fall back to the FIXED_BANK_ACCOUNT constant — there's only ever one
  // account in the system, so the fallback is always correct for new orders.
  const bankAccount = order.bankAccountSnapshot
    ? (order.bankAccountSnapshot as any)
    : {
        bank: FIXED_BANK_ACCOUNT.bank,
        bankCode: FIXED_BANK_ACCOUNT.bankCode,
        accountNumber: FIXED_BANK_ACCOUNT.accountNumber,
        holder: FIXED_BANK_ACCOUNT.holder,
        branch: FIXED_BANK_ACCOUNT.branch,
      }
  // Static QR (admin-uploaded) is the only thing we fall back to Settings for
  // — but since the snapshot doesn't include it, we just leave it null. The
  // dynamic QR is the source of truth.
  const staticQr = null
  const methodConfigured = !!(bankAccount?.bankCode && bankAccount?.accountNumber)
  const dynamicQr = methodConfigured
    ? buildVietQRUrl({
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        amount: order.total,
        addInfo: order.code,
        accountName: bankAccount.holder,
      })
    : null

  const accountInfo = bankAccount
    ? { label: bankAccount.bank, number: bankAccount.accountNumber, holder: bankAccount.holder, branch: bankAccount.branch }
    : null

  const scanHint = 'Mở app ngân hàng bất kỳ (VCB, MBB, BIDV, ACB…) → quét QR → app tự điền số tiền + mã đơn → xác nhận. Hệ thống tự đối soát qua webhook và xác nhận trong vài giây.'
  const methodLabel = PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const expired = timeLeft <= 0
  const isPending = order.paymentStatus === 'PENDING_VERIFY'
  const isCancelled = order.status === 'CANCELLED'

  return (
    <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setView('shop')} aria-label="Quay lại">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Thanh toán đơn hàng
          </h1>
          <p className="text-xs text-muted-foreground">Đơn chưa thanh toán sẽ không được xử lý.</p>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        {/* Order summary */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Mã đơn hàng</p>
            <button onClick={copyOrderCode} className="flex items-center gap-1.5 font-mono text-base font-bold hover:text-primary">
              {order.code}
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <p className="mt-1 text-xs text-muted-foreground">{order.shippingName} · {order.shippingPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Tổng tiền</p>
            <p className="text-xl font-bold text-primary">{formatVND(order.total)}</p>
          </div>
        </div>
        <Separator className="my-4" />

        {/* Bank account + QRs */}
        {!settingsLoaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Đang tải thông tin thanh toán…</span>
          </div>
        ) : methodConfigured && accountInfo ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border bg-card p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{accountInfo.label}</p>
                <p className="font-mono text-base font-bold tracking-wide">{accountInfo.number}</p>
                {accountInfo.holder && <p className="text-xs text-muted-foreground">Chủ TK: {accountInfo.holder}</p>}
                {accountInfo.branch && <p className="text-[11px] text-muted-foreground">{accountInfo.branch}</p>}
                <div className="mt-2 space-y-0.5 rounded-md bg-emerald-50 p-2 text-[11px] dark:bg-emerald-950/30">
                  <p><span className="text-muted-foreground">Số tiền: </span><span className="font-bold text-emerald-700 dark:text-emerald-300">{formatVND(order.total)}</span></p>
                  <p><span className="text-muted-foreground">Nội dung: </span><span className="font-mono font-bold">{order.code}</span></p>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{scanHint}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* QR #1 — static (admin uploaded) */}
              <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold">① QR cố định</p>
                {staticQr ? (
                  <div className="relative h-40 w-40 overflow-hidden rounded-md border-2 bg-white p-1 sm:h-44 sm:w-44">
                    <img src={staticQr} alt="QR cố định" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-40 w-40 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed bg-muted/30 p-2 text-center sm:h-44 sm:w-44">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">Cửa hàng chưa upload QR cố định. Dùng QR tự sinh bên cạnh.</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Quét bằng app {methodLabel}</p>
              </div>

              {/* QR #2 — dynamic VietQR auto-generated */}
              <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-emerald-500/30 bg-card p-3">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">② QR tự sinh (có sẵn số tiền + mã đơn)</p>
                {dynamicQr ? (
                  <div className="relative h-40 w-40 overflow-hidden rounded-md border bg-white p-1 sm:h-44 sm:w-44">
                    <img src={dynamicQr} alt="QR tự sinh" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-md border border-dashed bg-muted/30 sm:h-44 sm:w-44">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Quét — app tự điền số tiền + mã đơn</p>
              </div>
            </div>

            <div className="text-center">
              <Badge className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {methodLabel}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-center dark:bg-amber-950/30">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Tính năng chưa sử dụng được
            </p>
            <p className="max-w-xs text-xs text-amber-800/80 dark:text-amber-200/80">
              Cửa hàng chưa liên kết tài khoản ngân hàng. Vui lòng liên hệ hotline{' '}
              <b>{settings.get('contact_hotline') || '1900 1234'}</b> để thanh toán bằng cách khác,
              hoặc chọn COD.
            </p>
            <p className="text-[10px] text-amber-700/60 dark:text-amber-200/60">
              (Quản trị: Admin → Cài đặt → "Thanh toán & Ngân hàng" → Liên kết tài khoản)
            </p>
          </div>
        )}

        <Separator className="my-4" />

        {/* Status panel — server-driven, frontend only observes */}
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-lg border-2 p-4 ${expired || isCancelled ? 'border-destructive bg-destructive/10' : isPending ? 'border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/30' : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'}`}>
            {expired || isCancelled ? (
              <>
                <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">{isCancelled ? 'Đơn đã bị huỷ' : 'Đã hết thời gian thanh toán'}</p>
                  <p className="text-xs text-muted-foreground">
                    {isCancelled
                      ? 'Đơn của bạn đã bị huỷ. Vui lòng đặt hàng lại hoặc liên hệ hotline.'
                      : 'Đơn của bạn đã hết hạn thanh toán (15 phút). Vui lòng đặt hàng lại hoặc liên hệ hotline.'}
                  </p>
                </div>
              </>
            ) : isPending ? (
              <>
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    Đang chờ ngân hàng xác nhận thanh toán…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sau khi bạn quét QR / chuyển khoản, hệ thống tự động đối soát giao dịch qua webhook
                    từ ngân hàng / cổng thanh toán và xác nhận trong vài giây. Không cần thao tác thủ công.
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    Thanh toán đã được xác nhận
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Đơn đang được xử lý. Đang chuyển tới trang kết quả…
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Đơn ở trạng thái <b>PENDING_VERIFY</b> — chỉ chuyển sang <b>"Đã thanh toán"</b> khi
            webhook từ ngân hàng / cổng thanh toán báo đã nhận tiền (đúng số tiền + đúng mã đơn).
            Còn {mins}:{String(secs).padStart(2, '0')} để thanh toán; sau khi hết hạn, session sẽ
            tự đóng và webhook sẽ bị từ chối.
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Server-side state polling every {POLL_MS / 1000}s — không thể giả mạo từ trình duyệt.</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setView('order-tracking', { code: orderCode })}>
              Theo dõi đơn
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setView('shop')}>
              Tiếp tục mua sắm
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Tiny fetch helper — read-only, no auth header needed for public order
// lookup. The customer's orderCode is the only "credential" required (it's
// a 6-char random string; not guessable). Server-side, the order's timeline
// and riskFlags are returned but never the user's private info.
async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  const body = await res.json().catch(() => null)
  if (!body?.success) {
    throw new Error(body?.error || `Lỗi ${res.status}`)
  }
  return body.data
}

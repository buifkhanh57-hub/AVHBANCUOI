'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  ShieldCheck,
  MapPin,
  CreditCard,
  Banknote,
  Smartphone,
  QrCode,
  Loader2,
  Wrench,
  Calendar,
  Package,
  Check,
  ShoppingBag,
  AlertTriangle,
} from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCartStore, type CartLine } from '@/lib/stores/cart-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { api, ApiError } from '@/lib/api'
import { formatVND, PAYMENT_METHOD_LABELS } from '@/lib/format'
import { shippingFeeForSync } from '@/lib/shipping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

const PROVINCES = [
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Bà Rịa - Vũng Tàu',
  'Long An',
  'An Giang',
  'Bắc Ninh',
  'Bắc Giang',
  'Cần Thơ',
  'Đắk Lắk',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Nam',
  'Hà Tĩnh',
  'Hải Dương',
  'Hòa Bình',
  'Khánh Hòa',
  'Kiên Giang',
  'Lâm Đồng',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Sơn La',
  'Thanh Hóa',
  'Thái Bình',
  'Thái Nguyên',
  'Tiền Giang',
  'Vĩnh Phúc',
  'Vĩnh Long',
  'Yên Bái',
]

interface PaymentOption {
  value: string
  label: string
  icon: typeof CreditCard
  desc: string
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: 'COD',
    label: PAYMENT_METHOD_LABELS.COD,
    icon: Banknote,
    desc: 'Thanh toán bằng tiền mặt khi shipper giao hàng tận nhà.',
  },
  {
    value: 'BANK',
    label: PAYMENT_METHOD_LABELS.BANK,
    icon: CreditCard,
    desc: 'Chuyển khoản tới tài khoản AVH — quét QR tự sinh có sẵn số tiền + mã đơn.',
  },
]

const STEPS = [
  { num: 1, title: 'Thông tin giao hàng', icon: MapPin },
  { num: 2, title: 'Vận chuyển & lắp đặt', icon: Truck },
  { num: 3, title: 'Thanh toán', icon: CreditCard },
  { num: 4, title: 'Xác nhận', icon: Check },
]

interface ShippingForm {
  name: string
  phone: string
  province: string
  district: string
  ward: string
  detail: string
  note: string
}

interface VoucherResp {
  code: string
  description: string
  type: string
  value: number
  discount: number
}

export function CheckoutView() {
  const setView = useUIStore((s) => s.setView)
  const user = useAuthStore((s) => s.user)
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal)
  const voucherCode = useCartStore((s) => s.voucherCode)
  const setVoucher = useCartStore((s) => s.setVoucher)
  const clear = useCartStore((s) => s.clear)
  const settings = useSettingsStore()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<ShippingForm>({
    name: user?.name || '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    detail: '',
    note: '',
  })
  const [shippingMethod, setShippingMethod] = useState<
    'standard' | 'express'
  >('standard')
  const [needsInstallation, setNeedsInstallation] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD')

  const sub = subtotal()

  const voucherQuery = useQuery({
    queryKey: ['voucher', voucherCode, sub],
    enabled: !!voucherCode,
    queryFn: () =>
      api.get<VoucherResp>(
        `/api/vouchers?code=${encodeURIComponent(voucherCode!)}&subtotal=${sub}`
      ),
  })
  const discount = voucherQuery.data?.discount ?? 0

  const baseShipping = useMemo(
    () => shippingFeeForSync(form.province, sub, needsInstallation),
    [form.province, sub, needsInstallation]
  )
  const expressSurcharge = shippingMethod === 'express' ? 50000 : 0
  const shippingFee = baseShipping + expressSurcharge
  const total = Math.max(0, sub + shippingFee - discount)

  // Min order validation
  const minOrderAmount = Number(settings.get('min_order_amount') || '1000')
  const belowMin = sub < minOrderAmount

  // Fetch available vouchers (no code = list all active)
  const { data: availableVouchers } = useQuery<Array<{
    code: string; description: string; type: string; value: number; minOrder: number
  }>>({
    queryKey: ['vouchers-available'],
    queryFn: () => api.get('/api/vouchers'),
  })

  // Fetch saved addresses for this user — auto-fills the shipping form when
  // the customer picks one from the dropdown. Hidden for guests.
  const { data: savedAddresses } = useQuery<Array<{
    id: string; fullName: string; phone: string; province: string;
    district: string; ward: string; detail: string; isDefault: boolean
  }>>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/api/addresses'),
    enabled: !!user?.token,
  })
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')

  // Auto-select the default address on first load (so the form is pre-filled
  // immediately, the customer doesn't have to click anything).
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
      const def = savedAddresses.find((a) => a.isDefault) || savedAddresses[0]
      if (def) {
        setSelectedAddressId(def.id)
        setForm((f) => ({
          ...f,
          name: def.fullName,
          phone: def.phone,
          province: def.province,
          district: def.district,
          ward: def.ward,
          detail: def.detail,
        }))
      }
    }
  }, [savedAddresses, selectedAddressId])

  // Empty cart → show empty state with back-to-cart link
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/50 p-10 text-center sm:p-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShoppingBag className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              Giỏ hàng trống
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vui lòng thêm sản phẩm vào giỏ trước khi thanh toán.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setView('cart')} variant="outline">
              Xem giỏ hàng
            </Button>
            <Button onClick={() => setView('shop')} className="gap-1">
              Tiếp tục mua sắm
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Vui lòng nhập họ và tên'
    const phone = form.phone.trim()
    if (!/^0\d{9}$/.test(phone))
      return 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)'
    if (!form.province) return 'Vui lòng chọn tỉnh/thành phố'
    if (!form.district.trim()) return 'Vui lòng nhập quận/huyện'
    if (!form.ward.trim()) return 'Vui lòng nhập phường/xã'
    if (!form.detail.trim()) return 'Vui lòng nhập số nhà, tên đường'
    return null
  }

  const next = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) {
        toast.error(err)
        return
      }
    }
    if (step < 4) setStep(step + 1)
  }
  const back = () => {
    if (step > 1) setStep(step - 1)
    else setView('cart')
  }

  const submitOrder = async () => {
    // Block electronic payment methods that the merchant hasn't configured.
    // This prevents creating an order the customer can never pay for.
    const cfg = checkPaymentConfig(paymentMethod, settings)
    if (!cfg.ok) {
      toast.error(`Tính năng ${PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod} chưa sử dụng được`, {
        description: cfg.message,
      })
      setStep(3) // send customer back to payment-step to pick another method
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        shippingName: form.name.trim(),
        shippingPhone: form.phone.trim(),
        province: form.province,
        district: form.district.trim(),
        ward: form.ward.trim(),
        detail: form.detail.trim(),
        paymentMethod,
        voucherCode: voucherCode || undefined,
        note: form.note.trim() || undefined,
        needsInstallation,
        scheduledDate: scheduledDate || undefined,
        userId: user?.id,
      }
      const data = await api.post<{ code: string; id: string; total: number; paymentMethod: string; paymentStatus: string }>(
        '/api/orders',
        payload
      )
      clear()
      // Electronic payments (VNPay/MoMo/ZaloPay/BANK) MUST pay before the
      // order is fulfilled — navigate to the payment QR screen, NOT to the
      // success page. Only COD goes straight to success (pay on delivery).
      const ELECTRONIC = new Set(['BANK'])
      if (ELECTRONIC.has(paymentMethod)) {
        toast.success('Đơn đã tạo — vui lòng thanh toán để xác nhận', {
          description: `Mã đơn ${data.code} · ${formatVND(data.total)}`,
        })
        setView('payment', { code: data.code })
      } else {
        toast.success('Đặt hàng thành công', {
          description: `Mã đơn ${data.code} · Tổng ${formatVND(data.total)}`,
        })
        setView('order-success', { orderCode: data.code })
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Không thể đặt hàng, vui lòng thử lại'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Thanh toán</h1>
          <p className="text-sm text-muted-foreground">
            Hoàn tất đơn hàng trong 4 bước đơn giản
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 self-start sm:self-auto"
          onClick={() => setView('cart')}
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại giỏ hàng
        </Button>
      </div>

      {/* Stepper */}
      <nav aria-label="Tiến trình thanh toán" className="mb-6">
        <ol className="grid grid-cols-4 gap-2 sm:gap-4">
          {STEPS.map((s, idx) => {
            const done = step > s.num
            const active = step === s.num
            return (
              <li key={s.num} className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                  <div
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors sm:h-10 sm:w-10',
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : active
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground',
                    ].join(' ')}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={[
                      'hidden text-[11px] leading-tight sm:block sm:text-xs',
                      active
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {s.title}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={[
                      'h-0.5 flex-1 rounded-full transition-colors',
                      step > s.num ? 'bg-primary' : 'bg-border',
                    ].join(' ')}
                  />
                )}
              </li>
            )
          })}
        </ol>
        {/* Mobile label */}
        <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
          Bước {step}/4 · {STEPS[step - 1].title}
        </p>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Step content */}
        <div className="min-w-0">
          {step === 1 && (
            <Card className="p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                Thông tin giao hàng
              </h2>
              {/* Saved-address selector — pick a previously-saved address to
                  auto-fill the form. Hidden for guests (no auth token).
                  Use optional chaining + nullish guard because useQuery returns
                  undefined for `data` until the fetch resolves — without the
                  guard, `savedAddresses.length` throws "can't access length of undefined". */}
              {user && savedAddresses && savedAddresses.length > 0 && (
                <div className="mb-4 rounded-lg border bg-accent/30 p-3">
                  <Label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4" /> Chọn từ sổ địa chỉ đã lưu
                  </Label>
                  <Select
                    value={selectedAddressId}
                    onValueChange={(id) => {
                      setSelectedAddressId(id)
                      const addr = savedAddresses.find((a) => a.id === id)
                      if (addr) {
                        setForm((f) => ({
                          ...f,
                          name: addr.fullName,
                          phone: addr.phone,
                          province: addr.province,
                          district: addr.district,
                          ward: addr.ward,
                          detail: addr.detail,
                        }))
                        toast.success(`Đã điền: ${addr.fullName}, ${addr.detail}`)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="(nhập tay thay vì chọn)" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedAddresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.fullName} — {a.detail}, {a.ward}, {a.district}, {a.province}
                          {a.isDefault ? ' (mặc định)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Chọn địa chỉ → form tự điền. Quản lý sổ địa chỉ trong mục Tài khoản → Sổ địa chỉ.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="name">Họ và tên *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="phone">Số điện thoại *</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="09xxxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="province">Tỉnh / Thành phố *</Label>
                  <Select
                    value={form.province}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, province: v }))
                    }
                  >
                    <SelectTrigger id="province" className="w-full">
                      <SelectValue placeholder="Chọn tỉnh/thành" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="district">Quận / Huyện *</Label>
                  <Input
                    id="district"
                    value={form.district}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, district: e.target.value }))
                    }
                    placeholder="Quận 1, Gò Vấp, ..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ward">Phường / Xã *</Label>
                  <Input
                    id="ward"
                    value={form.ward}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ward: e.target.value }))
                    }
                    placeholder="Phường Bến Nghé, ..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail">Số nhà, tên đường *</Label>
                  <Input
                    id="detail"
                    value={form.detail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, detail: e.target.value }))
                    }
                    placeholder="123 Lê Lợi, ..."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
                  <Textarea
                    id="note"
                    rows={3}
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="Yêu cầu thời gian giao hàng, hướng dẫn địa chỉ, v.v."
                  />
                </div>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Truck className="h-5 w-5 text-primary" />
                Vận chuyển & lắp đặt
              </h2>

              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Phương thức vận chuyển</Label>
                  <RadioGroup
                    value={shippingMethod}
                    onValueChange={(v) =>
                      setShippingMethod(v as 'standard' | 'express')
                    }
                  >
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
                      <RadioGroupItem
                        value="standard"
                        className="mt-0.5"
                        aria-label="Giao tiêu chuẩn"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Giao tiêu chuẩn</p>
                          <span className="text-sm text-muted-foreground">
                            3-5 ngày
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
          Miễn phí ship cho đơn trên 3.000.000₫ tại các thành phố lớn.
                        </p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/40">
                      <RadioGroupItem
                        value="express"
                        className="mt-0.5"
                        aria-label="Giao nhanh"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Giao nhanh (+50.000₫)</p>
                          <span className="text-sm text-muted-foreground">
                            1-2 ngày
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ưu tiên xử lý và giao trong ngày tại nội thành.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      id="install"
                      checked={needsInstallation}
                      onCheckedChange={(v) =>
                        setNeedsInstallation(v === true)
                      }
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="install"
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          Cần lắp đặt tận nơi
                        </span>
                        <span className="ml-auto text-sm font-semibold text-primary">
                          +250.000₫
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Đội kỹ thuật AVH đến lắp ráp nội thất tận nhà (áp dụng
                        cho sofa, giường, tủ, bàn ghế phức tạp).
                      </p>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Ngày giao hàng mong muốn (tuỳ chọn)
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Chúng tôi sẽ liên hệ để xác nhận thời gian giao chính xác.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-accent/40 p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-accent-foreground">
                    <Truck className="h-4 w-4" />
                    Phí vận chuyển ước tính:{' '}
                    {shippingFee === 0 ? (
                      <span className="text-emerald-600">Miễn phí</span>
                    ) : (
                      <span>{formatVND(shippingFee)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Phí cuối cùng được tính dựa trên tỉnh/thành, tổng đơn và
                    dịch vụ lắp đặt.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CreditCard className="h-5 w-5 text-primary" />
                Phương thức thanh toán
              </h2>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => {
                  // Block selecting an unconfigured electronic method
                  const cfg = checkPaymentConfig(v, settings)
                  if (!cfg.ok) {
                    toast.error(`Tính năng ${PAYMENT_METHOD_LABELS[v] || v} chưa sử dụng được`, {
                      description: cfg.message,
                    })
                    return
                  }
                  setPaymentMethod(v)
                }}
              >
                {PAYMENT_OPTIONS.map((opt) => {
                  const cfg = checkPaymentConfig(opt.value, settings)
                  const disabled = !cfg.ok
                  return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-accent/40'
                    }`}
                  >
                    <RadioGroupItem
                      value={opt.value}
                      className="mt-0.5"
                      aria-label={opt.label}
                      disabled={disabled}
                    />
                    <div className="flex flex-1 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <opt.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="flex items-center gap-2 font-medium">
                          {opt.label}
                          {disabled && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Chưa liên kết
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {disabled ? cfg.message : opt.desc}
                        </p>
                      </div>
                    </div>
                  </label>
                  )
                })}
              </RadioGroup>
              {/* All electronic methods use the SAME bank account → show its info */}
              {paymentMethod !== 'COD' && <BankTransferInfo total={total} orderCodeHint="" method={paymentMethod} />}
            </Card>
          )}

          {step === 4 && (
            <Card className="p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Check className="h-5 w-5 text-primary" />
                Xác nhận đơn hàng
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="h-4 w-4" />
                    Địa chỉ giao hàng
                  </h3>
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {form.name} · {form.phone}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {form.detail}, {form.ward}, {form.district},{' '}
                      {form.province}
                    </p>
                    {form.note && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        Ghi chú: {form.note}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Truck className="h-4 w-4" />
                    Vận chuyển & lắp đặt
                  </h3>
                  <div className="rounded-lg border p-3 text-sm">
                    <p>
                      {shippingMethod === 'express'
                        ? 'Giao nhanh (1-2 ngày)'
                        : 'Giao tiêu chuẩn (3-5 ngày)'}
                      {needsInstallation && ' · Có lắp đặt tận nơi (+250.000₫)'}
                      {scheduledDate &&
                        ` · Hẹn giao: ${new Date(
                          scheduledDate
                        ).toLocaleDateString('vi-VN')}`}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4" />
                    Thanh toán
                  </h3>
                  <div className="rounded-lg border p-3 text-sm">
                    {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4" />
                    Sản phẩm ({items.length})
                  </h3>
                  <div className="space-y-2 rounded-lg border p-3">
                    {items.map((item, idx) => (
                      <ReviewLine
                        key={`${item.productId}-${item.variantId ?? 'base'}-${idx}`}
                        item={item}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Nav buttons */}
          {/* Min order warning */}
          {belowMin && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Đơn hàng tối thiểu <b>{formatVND(minOrderAmount)}</b>. Vui lòng thêm sản phẩm để tiếp tục.</p>
            </div>
          )}

          {/* Available vouchers */}
          {availableVouchers && availableVouchers.length > 0 && !belowMin && (
            <div className="rounded-lg border bg-card p-3">
              <p className="mb-2 text-sm font-semibold">Voucher khả dụng:</p>
              <div className="flex flex-wrap gap-2">
                {availableVouchers
                  .filter((v) => sub >= v.minOrder)
                  .map((v) => (
                    <button
                      key={v.code}
                      onClick={() => {
                        setVoucher(v.code)
                        toast.success(`Đã áp dụng ${v.code}`)
                      }}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        voucherCode === v.code
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:border-primary hover:bg-accent'
                      }`}
                    >
                      <b>{v.code}</b> — {v.description}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={back}
              className="gap-1"
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? 'Giỏ hàng' : 'Quay lại'}
            </Button>
            {step < 4 ? (
              <Button onClick={next} className="gap-1" disabled={belowMin}>
                Tiếp tục
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submitOrder}
                disabled={submitting || belowMin}
                className="gap-2"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {submitting ? 'Đang đặt hàng...' : 'Đặt hàng'}
              </Button>
            )}
          </div>
        </div>

        {/* Order summary sidebar */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">Đơn hàng của bạn</h2>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div
                  key={`${item.productId}-${item.variantId ?? 'base'}-${idx}`}
                  className="flex gap-3"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium leading-tight">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.color ? `Màu ${item.color}` : ''}
                      {item.color && item.material ? ' · ' : ''}
                      {item.material ?? ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-medium text-primary">
                    {formatVND(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(sub)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span>
                  {shippingFee === 0 ? (
                    <span className="text-emerald-600">Miễn phí</span>
                  ) : (
                    formatVND(shippingFee)
                  )}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá {voucherCode && `(${voucherCode})`}</span>
                  <span>-{formatVND(discount)}</span>
                </div>
              )}
              <Separator className="my-1.5" />
              <div className="flex justify-between text-base font-semibold">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(total)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-accent/40 p-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Bằng việc đặt hàng, bạn đồng ý với điều khoản & chính sách bảo
                mật của Nội Thất AVH. Giá được re-validate server-side.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function ReviewLine({ item }: { item: CartLine }) {
  return (
    <div className="flex gap-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="56px"
          className="object-cover"
        />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {item.quantity}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {item.color ? `Màu ${item.color}` : ''}
          {item.color && item.material ? ' · ' : ''}
          {item.material ?? ''}
        </p>
      </div>
      <p className="shrink-0 text-sm font-medium text-primary">
        {formatVND(item.unitPrice * item.quantity)}
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Bank transfer info — shows the SINGLE admin-linked bank account for
 * the BANK method. Customer scans the auto-generated QR after placing the
 * order — the QR already contains the exact amount + order code so any
 * banking app pre-fills the transfer.
 * ------------------------------------------------------------------------- */
function BankTransferInfo({ total, orderCodeHint, method }: { total: number; orderCodeHint: string; method: string }) {
  const settings = useSettingsStore()
  const banksJson = settings.get('payment_bank_accounts')
  const instructions = settings.get('payment_transfer_instructions')

  // parse bank accounts (single account expected)
  let banks: Array<{ bank: string; bankCode?: string; accountNumber: string; holder: string; branch?: string; qrUrl?: string }> = []
  try {
    banks = JSON.parse(banksJson || '[]')
  } catch {
    banks = []
  }
  const bank = banks[0]

  const scanHint = 'Sau khi đặt hàng, quét QR tự sinh bằng app ngân hàng bất kỳ (VCB, MBB, BIDV, ACB…) → app tự điền số tiền + mã đơn → xác nhận.'

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
      <div className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{instructions}</p>
      </div>

      {bank ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Tài khoản nhận tiền của AVH:
          </p>
          <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-[11px] text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <b>Sau khi bạn bấm "Đặt hàng",</b> hệ thống sẽ tự sinh 2 mã QR:
              QR cố định + QR tự sinh (kèm số tiền + mã đơn) để bạn quét.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-md border bg-card p-3">
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{bank.bank}</p>
              <p className="font-mono text-base font-bold tracking-wide">{bank.accountNumber}</p>
              <p className="text-xs text-muted-foreground">Chủ TK: {bank.holder}</p>
              {bank.branch && <p className="text-[11px] text-muted-foreground">{bank.branch}</p>}
              <div className="mt-2 space-y-0.5 rounded-md bg-amber-50 p-2 text-[11px] dark:bg-amber-950/40">
                <p><span className="text-muted-foreground">Số tiền: </span><span className="font-bold text-emerald-700 dark:text-emerald-300">{formatVND(total)}</span></p>
                <p><span className="text-muted-foreground">Nội dung: </span><span className="font-mono font-bold text-muted-foreground">Mã đơn (sau khi đặt hàng)</span></p>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{scanHint}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Cửa hàng chưa liên kết tài khoản ngân hàng. Vui lòng chọn COD hoặc liên hệ hotline.
        </p>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * PaymentConfigWarning — cảnh báo rõ ràng khi khách chọn chuyển khoản mà
 * cửa hàng chưa cấu hình tài khoản ngân hàng. Khách sẽ biết ngay tính năng
 * này chưa dùng được, chọn COD hoặc liên hệ hotline.
 * ------------------------------------------------------------------------- */
function PaymentConfigWarning({ method }: { method: string }) {
  const settings = useSettingsStore()
  // Đọc config
  const bankAccounts = (() => {
    try {
      const p = JSON.parse(settings.get('payment_bank_accounts') || '[]')
      return Array.isArray(p) ? p : []
    } catch { return [] }
  })()

  // Xác định xem phương thức này đã cấu hình chưa
  let configured = true
  let missingHint = ''
  if (method === 'BANK') {
    configured = bankAccounts.length > 0
    missingHint = 'cửa hàng chưa thêm tài khoản ngân hàng'
  }

  if (configured) {
    // Đã cấu hình → hiện gợi ý QR (như cũ)
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Sau khi đặt hàng, bạn sẽ được chuyển tới màn hình QR thanh toán.
          Quét mã bằng app ngân hàng để thanh toán ngay. Đơn chỉ xử lý sau khi xác nhận.
        </p>
      </div>
    )
  }

  // Chưa cấu hình → cảnh báo rõ ràng
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="font-semibold">
          Tính năng này chưa sử dụng được
        </p>
        <p>
          Cửa hàng chưa cấu hình {missingHint}. Vui lòng:
        </p>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>Chọn <b>thanh toán khi nhận hàng (COD)</b> ở trên, HOẶC</li>
          <li>Liên hệ hotline <b>{settings.get('contact_hotline') || '1900 1234'}</b> để được hỗ trợ</li>
        </ul>
        <p className="text-[11px] text-amber-700/80 dark:text-amber-200/70">
          (Quản trị viên vào Admin → Cài đặt → "Thanh toán & Ngân hàng" để thêm tài khoản)
        </p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Helper: check whether a payment method is configured by the merchant.
 * Returns { ok: boolean, message: string }. Used by both submitOrder (to
 * block unconfigurable orders) and PaymentConfigWarning (to show the hint).
 * ------------------------------------------------------------------------- */
export function checkPaymentConfig(
  method: string,
  settings: ReturnType<typeof useSettingsStore.getState>
): { ok: boolean; message: string } {
  // COD always available.
  if (method === 'COD') return { ok: true, message: '' }

  // BANK (and any other electronic method) needs the single admin-linked
  // bank account to be configured. If not set, the customer can't pay → block.
  let banks: any[] = []
  try {
    const p = JSON.parse(settings.get('payment_bank_accounts') || '[]')
    banks = Array.isArray(p) ? p : []
  } catch { banks = [] }

  const first = banks[0]
  if (!first || !first.bankCode || !first.accountNumber) {
    return {
      ok: false,
      message: 'Cửa hàng chưa liên kết tài khoản ngân hàng. Vui lòng chọn COD hoặc liên hệ hotline.',
    }
  }
  return { ok: true, message: '' }
}

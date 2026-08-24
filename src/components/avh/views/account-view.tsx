'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { useAuthStore, AuthUser } from '@/lib/stores/auth-store'
import { useWishlistStore } from '@/lib/stores/wishlist-store'
import {
  formatVND,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  MEMBER_TIERS,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  User,
  LogOut,
  Package,
  MapPin,
  Heart,
  Award,
  Bell,
  ChevronRight,
  Trophy,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Plus,
  Edit,
  Trash2,
  Check,
  Save,
  Loader2,
} from 'lucide-react'

interface OrderItem {
  id: string
  name: string
  image: string
  unitPrice: number
  quantity: number
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
  timeline: { status: string; at: string; note?: string }[]
  items: OrderItem[]
  createdAt: string
}

type TabKey =
  | 'overview'
  | 'orders'
  | 'addresses'
  | 'wishlist'
  | 'membership'
  | 'notifications'

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'overview', label: 'Tổng quan', icon: User },
  { key: 'orders', label: 'Đơn hàng của tôi', icon: Package },
  { key: 'addresses', label: 'Sổ địa chỉ', icon: MapPin },
  { key: 'wishlist', label: 'Yêu thích', icon: Heart },
  { key: 'membership', label: 'Thành viên & điểm', icon: Award },
  { key: 'notifications', label: 'Thông báo', icon: Bell },
]

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40',
  PROCESSING: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-300/40',
  SHIPPING: 'bg-primary/15 text-primary border-primary/30',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/40',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300/40',
  REFUNDED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300/40',
}

// Tier thresholds in points: SILVER -> 0, GOLD -> 3000, PLATINUM -> 10000
const TIER_THRESHOLDS: { tier: string; min: number; next?: number; label: string }[] = [
  { tier: 'SILVER', min: 0, next: 3000, label: 'Bạc' },
  { tier: 'GOLD', min: 3000, next: 10000, label: 'Vàng' },
  { tier: 'PLATINUM', min: 10000, label: 'Bạch Kim' },
]

export function AccountView() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setView = useUIStore((s) => s.setView)
  const [tab, setTab] = useState<TabKey>('overview')

  // Not logged in — show prompt
  if (!user) {
    return <LoginPrompt />
  }

  const handleLogout = () => {
    logout()
    toast.success('Đã đăng xuất')
    setView('home')
  }

  const currentTab = TABS.find((t) => t.key === tab)!

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Page header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/30">
            <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
              {(user.name || user.email || 'K').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Tài khoản
            </p>
            <h1 className="text-lg font-bold sm:text-xl">{user.name}</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Đăng xuất
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <Card className="overflow-hidden">
            <CardContent className="p-2">
              <nav className="flex flex-col">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                      tab === t.key
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <t.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{t.label}</span>
                    {tab === t.key && <ChevronRight className="h-4 w-4" />}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        {/* Mobile tab bar */}
        <div className="-mx-3 px-3 lg:hidden">
          <ScrollArea className="w-full">
            <div className="flex w-max gap-1.5 pb-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    tab === t.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <main>
          {tab === 'overview' && <OverviewTab user={user} setTab={setTab} />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'addresses' && <AddressesTab />}
          {tab === 'wishlist' && <WishlistTab />}
          {tab === 'membership' && <MembershipTab user={user} />}
          {tab === 'notifications' && <NotificationsTab />}
        </main>
      </div>
    </div>
  )
}

/* ---------------- Login prompt (not authenticated) ---------------- */

function LoginPrompt() {
  const setView = useUIStore((s) => s.setView)
  const openAuthDialog = () => {
    document.querySelector<HTMLButtonElement>('[aria-label="Tài khoản"]')?.click()
  }
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <User className="h-9 w-9" />
      </div>
      <h1 className="mt-5 text-xl font-bold sm:text-2xl">Vui lòng đăng nhập</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Đăng nhập để theo dõi đơn hàng, tích điểm thành viên và lưu danh sách
        sản phẩm yêu thích.
      </p>
      <Button className="mt-6 gap-1.5" onClick={openAuthDialog}>
        Đăng nhập / Đăng ký <ArrowRight className="h-4 w-4" />
      </Button>
      <Button
        variant="link"
        size="sm"
        className="mt-2 text-muted-foreground"
        onClick={() => setView('home')}
      >
        Về trang chủ
      </Button>
    </div>
  )
}

/* ---------------- Overview ---------------- */

function OverviewTab({
  user,
  setTab,
}: {
  user: AuthUser
  setTab: (t: TabKey) => void
}) {
  const wishlistCount = useWishlistStore((s) => s.productIds.length)
  const setView = useUIStore((s) => s.setView)
  const setUser = useAuthStore((s) => s.setUser)
  const qc = useQueryClient()
  const [editName, setEditName] = useState(false)
  const [nameDraft, setNameDraft] = useState(user.name || '')
  const [savingName, setSavingName] = useState(false)

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['orders', user.id],
    queryFn: () => api.get(`/api/orders?userId=${user.id}`),
    staleTime: 60 * 1000,
  })

  const orderCount = orders?.length ?? 0
  const tier = user.memberTier || 'SILVER'
  const tierMeta = MEMBER_TIERS[tier] || MEMBER_TIERS.SILVER
  const points = user.loyaltyPoints ?? 0

  async function saveName() {
    if (nameDraft.trim().length < 2) {
      toast.error('Tên phải từ 2 ký tự')
      return
    }
    setSavingName(true)
    try {
      await api.put('/api/auth/profile', { name: nameDraft.trim() })
      setUser({ ...user, name: nameDraft.trim() })
      await qc.invalidateQueries({ queryKey: ['orders', user.id] })
      toast.success('Đã cập nhật tên')
      setEditName(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật thất bại')
    } finally {
      setSavingName(false)
    }
  }

  const stats = [
    { label: 'Đơn hàng', value: orderCount, icon: Package, tab: 'orders' as const },
    { label: 'Yêu thích', value: wishlistCount, icon: Heart, tab: 'wishlist' as const },
    { label: 'Điểm tích luỹ', value: points, icon: Award, tab: 'membership' as const },
  ]

  return (
    <div className="space-y-5">
      {/* User info card with inline edit-name */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-primary/30">
                <AvatarFallback className="bg-primary/15 text-xl font-bold text-primary">
                  {(user.name || user.email || 'K').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                {editName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="h-8 w-40 text-sm"
                      placeholder="Họ và tên"
                      autoFocus
                    />
                    <Button size="sm" className="h-8 gap-1" onClick={saveName} disabled={savingName}>
                      {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Lưu
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditName(false); setNameDraft(user.name || '') }}>
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold">{user.name}</p>
                    <button onClick={() => setEditName(true)} className="text-muted-foreground hover:text-primary" aria-label="Sửa tên">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`gap-1 border-primary/30 bg-primary/5 ${tierMeta.color}`}
                  >
                    <Trophy className="h-3 w-3" /> Hạng {tierMeta.label}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Award className="h-3 w-3" /> {points.toLocaleString('vi-VN')} điểm
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-start gap-1.5"
              onClick={() => setTab('membership')}
            >
              Xem đặc quyền <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => setTab(s.tab)}
            className="group rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm sm:p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground sm:text-sm">
                {s.label}
              </span>
              <s.icon className="h-4 w-4 text-primary/70 group-hover:text-primary" />
            </div>
            <div className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
              {isLoading ? <Skeleton className="h-6 w-10" /> : s.value}
            </div>
          </button>
        ))}
      </div>

      {/* Recent orders preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-sm font-bold sm:text-base">Đơn hàng gần đây</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setTab('orders')}
          >
            Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Package className="h-9 w-9 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Bạn chưa có đơn hàng nào
              </p>
              <Button
                size="sm"
                className="mt-1 gap-1.5"
                onClick={() => setView('shop')}
              >
                <ShoppingBag className="h-4 w-4" /> Bắt đầu mua sắm
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {orders.slice(0, 3).map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{o.code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('vi-VN')} ·{' '}
                      {o.items.length} sản phẩm
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[o.status] || ''}
                    >
                      {ORDER_STATUS_LABELS[o.status] || o.status}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">
                      {formatVND(o.total)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() =>
                        setView('order-tracking', { code: o.code })
                      }
                    >
                      Chi tiết <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------- Orders ---------------- */

function OrdersTab() {
  const user = useAuthStore((s) => s.user)
  const setView = useUIStore((s) => s.setView)
  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders', user?.id],
    queryFn: () => api.get(`/api/orders?userId=${user!.id}`),
    enabled: !!user?.token,
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Không tải được đơn hàng"
        message={(error as ApiError).message || 'Vui lòng thử lại sau.'}
      />
    )
  }

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Bạn chưa có đơn hàng nào"
        subtitle="Khám phá nội thất AVH và đặt đơn đầu tiên."
        cta="Đi mua sắm"
        onCta={() => setView('shop')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold sm:text-lg">
        Đơn hàng của tôi ({orders.length})
      </h2>
      {orders.map((o) => {
        const itemCount = o.items.reduce((n, i) => n + i.quantity, 0)
        return (
          <Card key={o.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-primary">{o.code}</p>
                    {/* Payment status badge — same 4-state color coding as the
                        admin Orders tab so the customer can see at a glance
                        whether their order is paid / pending / unpaid. */}
                    {o.paymentStatus === 'PAID' && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950/40 dark:text-emerald-300">
                        Đã thanh toán
                      </Badge>
                    )}
                    {o.paymentStatus === 'PENDING_VERIFY' && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] dark:bg-amber-950/40 dark:text-amber-300">
                        Chờ xác nhận TT
                      </Badge>
                    )}
                    {o.paymentStatus === 'UNPAID' && (
                      <Badge className="bg-slate-100 text-slate-600 text-[10px] dark:bg-slate-800/60 dark:text-slate-300">
                        Chưa thanh toán
                      </Badge>
                    )}
                    {o.paymentStatus === 'REFUNDED' && (
                      <Badge className="bg-rose-100 text-rose-700 text-[10px] dark:bg-rose-950/40 dark:text-rose-300">
                        Đã hoàn tiền
                      </Badge>
                    )}
                    {/* Order fulfilment status (separate from payment) */}
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[o.status] || ''}
                    >
                      {ORDER_STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Đặt ngày{' '}
                    {new Date(o.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}{' '}
                    · {itemCount} sản phẩm
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Tổng cộng</p>
                    <p className="font-semibold text-primary">
                      {formatVND(o.total)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setView('order-tracking', { code: o.code })}
                  >
                    Xem chi tiết <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ---------------- Addresses ---------------- */
//
// Full Address Book CRUD — the customer can save multiple shipping
// addresses (home, office, parents' house, etc.) so the next checkout
// is one click: pick an address → form auto-fills. No more re-typing
// name/phone/province/district/ward/detail on every purchase.
//
// Backed by:
//   GET    /api/addresses        — list current user's addresses
//   POST   /api/addresses        — create a new address
//   PATCH  /api/addresses/[id]   — update (rename / fix typo / set default)
//   DELETE /api/addresses/[id]   — remove
//
// Auth: the JWT token from auth-store is attached automatically by `api`.

interface AddressRow {
  id: string
  fullName: string
  phone: string
  province: string
  district: string
  ward: string
  detail: string
  isDefault: boolean
  createdAt: string
}

const EMPTY_ADDRESS_DRAFT = {
  fullName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  detail: '',
  isDefault: false,
}

function AddressesTab() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_ADDRESS_DRAFT)
  const [saving, setSaving] = useState(false)

  const { data: addresses, isLoading } = useQuery<AddressRow[]>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/api/addresses'),
    enabled: !!user?.token,
  })

  function startAdd() {
    setDraft({ ...EMPTY_ADDRESS_DRAFT, fullName: user?.name || '' })
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(a: AddressRow) {
    setDraft({
      fullName: a.fullName,
      phone: a.phone,
      province: a.province,
      district: a.district,
      ward: a.ward,
      detail: a.detail,
      isDefault: a.isDefault,
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  async function save() {
    if (!draft.fullName.trim() || !draft.phone.trim() || !draft.province.trim() || !draft.district.trim() || !draft.ward.trim() || !draft.detail.trim()) {
      toast.error('Vui lòng điền đầy đủ họ tên, SĐT, tỉnh/huyện/xã/số nhà')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/api/addresses/${editingId}`, draft)
        toast.success('Đã cập nhật địa chỉ')
      } else {
        await api.post('/api/addresses', draft)
        toast.success('Đã thêm địa chỉ mới')
      }
      await qc.invalidateQueries({ queryKey: ['addresses'] })
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Xoá địa chỉ này?')) return
    try {
      await api.del(`/api/addresses/${id}`)
      await qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Đã xoá')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xoá thất bại')
    }
  }

  async function setDefault(id: string) {
    try {
      await api.put(`/api/addresses/${id}`, { isDefault: true })
      await qc.invalidateQueries({ queryKey: ['addresses'] })
      toast.success('Đã đặt làm mặc định')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Đặt mặc định thất bại')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold sm:text-lg">Sổ địa chỉ</h2>
        {!showForm && (
          <Button size="sm" className="gap-1.5" onClick={startAdd}>
            <Plus className="h-4 w-4" /> Thêm địa chỉ
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Đang tải…</CardContent></Card>
      ) : !addresses || addresses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Chưa có địa chỉ nào</p>
            <p className="text-xs text-muted-foreground">
              Thêm địa chỉ để lần thanh toán sau chỉ cần 1 click chọn — không cần nhập lại.
            </p>
            <Button size="sm" className="mt-2 gap-1.5" onClick={startAdd}>
              <Plus className="h-4 w-4" /> Thêm địa chỉ đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{a.fullName}</p>
                      {a.isDefault && (
                        <Badge variant="secondary" className="text-[10px]">Mặc định</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.phone}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {a.detail}, {a.ward}, {a.district}, {a.province}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => startEdit(a)}>
                        <Edit className="h-3 w-3" /> Sửa
                      </Button>
                      {!a.isDefault && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setDefault(a.id)}>
                          <Check className="h-3 w-3" /> Đặt mặc định
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive" onClick={() => remove(a.id)}>
                        <Trash2 className="h-3 w-3" /> Xoá
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">{editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Họ và tên *</Label>
                <Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} placeholder="Nguyễn Văn A" />
              </div>
              <div className="space-y-1.5">
                <Label>Số điện thoại *</Label>
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, '') })} placeholder="0909123456" inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label>Tỉnh / Thành phố *</Label>
                <Input value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })} placeholder="Hồ Chí Minh" />
              </div>
              <div className="space-y-1.5">
                <Label>Quận / Huyện *</Label>
                <Input value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} placeholder="Quận 1" />
              </div>
              <div className="space-y-1.5">
                <Label>Phường / Xã *</Label>
                <Input value={draft.ward} onChange={(e) => setDraft({ ...draft, ward: e.target.value })} placeholder="Phường Bến Nghé" />
              </div>
              <div className="space-y-1.5">
                <Label>Số nhà, tên đường *</Label>
                <Input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="123 Lê Lợi" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                className="h-4 w-4"
              />
              Đặt làm địa chỉ mặc định
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> {saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Thêm địa chỉ'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>
                Huỷ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Địa chỉ được lưu riêng cho tài khoản của bạn. Lần thanh toán sau, chỉ cần chọn từ sổ — form tự điền.
      </p>
    </div>
  )
}

/* ---------------- Wishlist shortcut ---------------- */

function WishlistTab() {
  const setView = useUIStore((s) => s.setView)
  const productIds = useWishlistStore((s) => s.productIds)
  const count = productIds.length

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold sm:text-lg">Sản phẩm yêu thích</h2>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{count} sản phẩm đã lưu</p>
              <p className="text-xs text-muted-foreground">
                Xem và quản lý danh sách yêu thích của bạn
              </p>
            </div>
          </div>
          <Button className="gap-1.5" onClick={() => setView('wishlist')}>
            Xem danh sách <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------- Membership ---------------- */

function MembershipTab({ user }: { user: AuthUser }) {
  const tier = (user.memberTier || 'SILVER').toUpperCase()
  const points = user.loyaltyPoints ?? 0
  const currentIdx = Math.max(
    0,
    TIER_THRESHOLDS.findIndex((t) => t.tier === tier)
  )
  const current = TIER_THRESHOLDS[currentIdx]
  const next = current.next

  // Progress to next tier
  let progressPct = 100
  let remaining = 0
  if (next) {
    const range = next - current.min
    const earned = Math.max(0, points - current.min)
    progressPct = Math.min(100, Math.round((earned / range) * 100))
    remaining = Math.max(0, next - points)
  }

  const benefits: Record<string, string[]> = {
    SILVER: [
      'Tích điểm 1% giá trị đơn hàng',
      'Ưu đãi sinh nhật',
      'Miễn phí giao hàng đơn từ 3 triệu',
    ],
    GOLD: [
      'Tích điểm 1.5% giá trị đơn hàng',
      'Miễn phí giao hàng toàn quốc',
      'Ưu đãi độc quyền mỗi tháng',
      'Đổi voucher giảm 100k cho đơn 2tr',
    ],
    PLATINUM: [
      'Tích điểm 2% giá trị đơn hàng',
      'Miễn phí lắp đặt tận nơi',
      'Đặc quyền dùng thử sản phẩm mới',
      'Hỗ trợ 1-1 qua trợ lý AVH',
      'Hoàn tiền 5% khi hoàn đơn',
    ],
  }
  const tierMeta = MEMBER_TIERS[tier] || MEMBER_TIERS.SILVER

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold sm:text-lg">Thành viên & điểm</h2>

      {/* Current tier card */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-accent/30">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Trophy className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Hạng hiện tại
                </p>
                <p className={`text-2xl font-bold ${tierMeta.color}`}>
                  {tierMeta.label}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Điểm tích luỹ
              </p>
              <p className="text-2xl font-bold text-primary">
                {points.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Progress to next tier */}
          {next ? (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Cần thêm{' '}
                  <span className="font-semibold text-foreground">
                    {remaining.toLocaleString('vi-VN')}
                  </span>{' '}
                  điểm để lên hạng{' '}
                  <span className="font-semibold text-primary">
                    {TIER_THRESHOLDS[currentIdx + 1].label}
                  </span>
                </span>
                <span className="font-semibold">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-primary/10 p-3 text-center text-sm font-medium text-primary">
              Bạn đã đạt hạng cao nhất — Bạch Kim. Cảm ơn bạn đã đồng hành cùng
              AVH!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier ladder */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TIER_THRESHOLDS.map((t) => {
          const meta = MEMBER_TIERS[t.tier]
          const isActive = t.tier === tier
          return (
            <div
              key={t.tier}
              className={`rounded-lg border p-3 text-center transition ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              <Trophy className={`mx-auto h-5 w-5 ${meta.color}`} />
              <p className={`mt-1 text-sm font-bold ${meta.color}`}>
                {t.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t.tier === 'SILVER'
                  ? '0 điểm trở lên'
                  : `${t.min.toLocaleString('vi-VN')} điểm trở lên`}
              </p>
            </div>
          )
        })}
      </div>

      {/* Benefits */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-bold">
            Đặc quyền hạng {tierMeta.label}
          </h3>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {(benefits[tier] || benefits.SILVER).map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Điểm được cộng tự động sau khi đơn hàng hoàn tất. 1 điểm = 1.000₫ giá
        trị đơn hàng.
      </p>
    </div>
  )
}

/* ---------------- Notifications (sample) ---------------- */

const SAMPLE_NOTIFICATIONS: {
  type: 'order' | 'promo' | 'reply' | 'chat'
  title: string
  body: string
  time: string
}[] = [
  {
    type: 'order',
    title: 'Đơn hàng của bạn đang được xử lý',
    body: 'Đơn AVH-XXXXXX sẽ được giao trong 2-4 ngày tới.',
    time: '2 giờ trước',
  },
  {
    type: 'promo',
    title: 'Flash sale cuối tuần — giảm 35%',
    body: 'Sofa, giường, tủ bếp giảm sâu chỉ đến hết Chủ nhật.',
    time: '5 giờ trước',
  },
  {
    type: 'reply',
    title: 'Câu hỏi của bạn đã được trả lời',
    body: 'Nội thất AVH đã phản hồi câu hỏi về sản phẩm Sofa Linen 3 chỗ.',
    time: 'Hôm qua',
  },
  {
    type: 'chat',
    title: 'Trợ lý AVH: bạn cần tư vấn thêm?',
    body: 'Mình có thể giúp bạn chọn được sofa phù hợp phòng khách 20m² nhé.',
    time: '2 ngày trước',
  },
]

function NotificationsTab() {
  const iconFor = (t: string) => {
    switch (t) {
      case 'order':
        return Package
      case 'promo':
        return Trophy
      case 'reply':
        return CheckCircle2
      default:
        return Bell
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold sm:text-lg">Thông báo</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => toast.info('Đã đánh dấu tất cả là đã đọc')}
        >
          Đánh dấu đã đọc
        </Button>
      </div>
      <ul className="space-y-2">
        {SAMPLE_NOTIFICATIONS.map((n, i) => {
          const Icon = iconFor(n.type)
          return (
            <li key={i}>
              <Card className="overflow-hidden">
                <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {n.time}
                    </p>
                  </div>
                  {i === 0 && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className="text-center text-xs text-muted-foreground">
        Đây là thông báo mẫu. Khi bạn có đơn hàng hoặc tin nhắn mới, thông báo
        sẽ xuất hiện tại đây.
      </p>
    </div>
  )
}

/* ---------------- Shared helpers ---------------- */

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  cta,
  onCta,
}: {
  icon: typeof User
  title: string
  subtitle?: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <p className="font-semibold">{title}</p>
      {subtitle && (
        <p className="max-w-sm text-xs text-muted-foreground">{subtitle}</p>
      )}
      {cta && onCta && (
        <Button size="sm" className="mt-2 gap-1.5" onClick={onCta}>
          {cta} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-50/50 py-12 text-center dark:bg-red-950/20">
      <p className="font-semibold text-red-700 dark:text-red-300">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

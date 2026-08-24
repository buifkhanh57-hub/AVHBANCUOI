'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useAuthStore, AuthUser } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { VN_BANKS, buildVietQRUrl } from '@/lib/vn-banks'
import { FIXED_BANK_ACCOUNT } from '@/lib/fixed-bank-account'
import { SUPER_ADMIN_EMAIL } from '@/lib/super-admin'
import { formatVND, ORDER_STATUS_LABELS } from '@/lib/format'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Tag,
  Star,
  Settings,
  Plus,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Save,
  ShieldCheck,
  Flame,
  Phone,
  Share2,
  Truck,
  Megaphone,
  AlignLeft,
  Store,
  FolderPlus,
  Calendar,
  Image as ImageIcon,
  Eye,
  Loader2,
  CreditCard,
  CheckCircle2,
  Lock,
  Bot,
  Send,
  Terminal,
  FileEdit,
  History,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MediaUploader, MediaItem } from '@/components/avh/media-uploader'

type TabId = 'overview' | 'products' | 'categories' | 'orders' | 'pendingPayments' | 'promotions' | 'flashSale' | 'reviews' | 'logs' | 'settings' | 'aiAgent' | 'updateLog'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'products', label: 'Sản phẩm', icon: Package },
  { id: 'categories', label: 'Danh mục', icon: FolderPlus },
  { id: 'orders', label: 'Đơn hàng', icon: ShoppingBag },
  { id: 'pendingPayments', label: 'Chờ thanh toán', icon: CreditCard },
  { id: 'promotions', label: 'Khuyến mãi', icon: Tag },
  { id: 'flashSale', label: 'Flash Sale', icon: Flame },
  { id: 'reviews', label: 'Đánh giá', icon: Star },
  { id: 'logs', label: 'Logs', icon: AlertTriangle },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

// Super-admin-only tabs — AI Dev Agent + Update Log (backups). These are
// added to TABS only when the logged-in admin is the hardcoded super-admin
// email. Other admins don't see these tabs.
const SUPER_ADMIN_TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'aiAgent', label: 'AI Dev Agent', icon: Bot },
  { id: 'updateLog', label: 'Nhật ký cập nhật', icon: History },
]

const CHART_COLORS = ['#c2654a', '#7a8b5a', '#6b4423', '#d4a017', '#5a6b7c']

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PROCESSING: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  SHIPPING: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  REFUNDED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

interface AdminStats {
  revenue: number
  orders: number
  products: number
  customers: number
  pendingOrders: number
  lowStock: number
  recentOrders: {
    id: string
    code: string
    total: number
    status: string
    paymentStatus?: string
    paymentMethod?: string
    shippingName?: string
    itemCount: number
    createdAt: string
  }[]
  topProducts: {
    id: string
    name: string
    sold: number
    revenue: number
    image: string
  }[]
  revenueSeries: { date: string; revenue: number; orders: number }[]
  categoryBreakdown: { name: string; productCount: number }[]
}

interface AdminProduct {
  id: string
  name: string
  slug: string
  brand?: string
  basePrice: number
  comparePrice?: number | null
  isFeatured?: boolean
  isNew?: boolean
  isFlashSale?: boolean
  image: string
  category?: { id: string; slug: string; name: string }
  inStock?: boolean
}

interface Category {
  id: string
  name: string
  slug: string
  productCount: number
  imageUrl?: string | null
  icon?: string | null
}

interface Voucher {
  id: string
  code: string
  description?: string
  type: string
  value: number
  minOrder?: number
  maxDiscount?: number | null
  startAt: string
  endAt: string
  active: boolean
  usedCount?: number
  usageLimit?: number | null
}

interface Banner {
  id: string
  title: string
  imageUrl: string
  active: boolean
  sortOrder?: number
}

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
  voucherCode?: string | null
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note?: string | null
  needsInstallation?: boolean
  scheduledDate?: string | null
  timeline: { status: string; at: string; note?: string }[]
  items: { id: string; name: string; image: string; unitPrice: number; quantity: number }[]
  createdAt: string
}

export function AdminView() {
  const user = useAuthStore((s) => s.user) as AuthUser | null
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Access control
  if (!user || user.role !== 'ADMIN') {
    return <AccessDenied />
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <header className="mb-5 flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Bảng điều khiển
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Xin chào, <span className="font-medium text-foreground/80">{user.name}</span> —
            quản trị nội dung & vận hành AVH Home.
          </p>
        </div>
      </header>

      {/* Layout: sidebar (lg+) / top tab bar (mobile) */}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Sidebar (desktop) — super-admin (email === SUPER_ADMIN_EMAIL)
            sees an extra "AI Dev Agent" tab at the bottom. Other admins
            don't see it. The backend API also enforces this (POST
            /api/admin/ai-agent checks email === SUPER_ADMIN_EMAIL). */}
        <aside className="hidden lg:block">
          <nav className="sticky top-4 space-y-1 rounded-xl border bg-card p-2">
            {(user.email === SUPER_ADMIN_EMAIL ? [...TABS, ...SUPER_ADMIN_TABS] : TABS).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === t.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {activeTab === t.id && <ChevronRight className="ml-auto h-4 w-4" />}
                {t.id === 'aiAgent' && (
                  <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                    SUPER
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Top tab bar (mobile) */}
        <div className="-mx-3 mb-2 overflow-x-auto px-3 lg:hidden">
          <div className="flex w-max gap-1.5">
            {(user.email === SUPER_ADMIN_EMAIL ? [...TABS, ...SUPER_ADMIN_TABS] : TABS).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === t.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground/70'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <section className="min-w-0">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'products' && <ProductsTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'pendingPayments' && <PendingPaymentsTab />}
          {activeTab === 'promotions' && <PromotionsTab />}
          {activeTab === 'flashSale' && <FlashSaleTab />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {/* Super-admin-only tab — rendered only when the admin's email
              matches the hardcoded super-admin. The API also enforces
              this server-side, so even if the tab is somehow clicked by
              a non-super-admin, the AI agent calls will 403. */}
          {activeTab === 'aiAgent' && user.email === SUPER_ADMIN_EMAIL && <AiAgentTab />}
          {activeTab === 'updateLog' && user.email === SUPER_ADMIN_EMAIL && <UpdateLogTab />}
        </section>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * AI Dev Agent tab — super-admin only. Chat with the AI Dev Agent that can
 * read/write project files + run shell commands. Used for fixing the web
 * anytime, even after public launch.
 * ------------------------------------------------------------------------- */
function AiAgentTab() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; actions?: any[] }>>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [model, setModel] = useState('glm-5.2')
  const [thinking, setThinking] = useState(true)

  async function send() {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }]
    setMessages(newMessages)
    setSending(true)
    try {
      const data = await api.post<{
        reply: string
        actions: Array<{
          kind: string
          target?: string
          ok: boolean
          output: string
          backupPath?: string
          timestamp?: string
        }>
      }>('/api/admin/ai-agent', { message: userMsg, history: messages.map((m) => ({ role: m.role, content: m.content })), model, thinking })
      setMessages([...newMessages, { role: 'assistant' as const, content: data.reply, actions: data.actions }])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI Agent lỗi')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Bot className="h-4 w-4 text-primary" /> AI Dev Agent
            <Badge className="bg-amber-500/15 text-amber-700 text-[10px] dark:text-amber-300">SUPER ADMIN</Badge>
          </CardTitle>
          <CardDescription>
            Trợ lý AI của Bùi Khánh — đọc/sửa code, chạy lệnh shell, query DB. Fix web mọi lúc, kể cả khi đã public.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Model selector + thinking toggle */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium whitespace-nowrap">Model:</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="glm-5.2">GLM 5.2 (mới nhất, tư duy sâu)</SelectItem>
              <SelectItem value="glm-5">GLM 5 (ổn định)</SelectItem>
              <SelectItem value="glm-4-flash">GLM 4 Flash (nhanh, nhẹ)</SelectItem>
              <SelectItem value="glm-4">GLM 4 (cũ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={thinking}
            onChange={(e) => setThinking(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Thinking mode (chain-of-thought)
        </label>
        <Badge variant="outline" className="text-[10px]">{model}</Badge>
        {thinking && <Badge variant="outline" className="bg-purple-50 text-purple-600 text-[10px] dark:bg-purple-950/30 dark:text-purple-300">🧠 Thinking ON</Badge>}
      </div>

      {/* Chat history */}
      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border bg-card p-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Bot className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p className="font-medium">AI Dev Agent sẵn sàng</p>
            <p className="mt-1 text-xs">
              Ví dụ: "Fix hydration bug trong home-view" hoặc "Thêm tính năng X vào product-card".
              AI sẽ tự sửa code + chạy lệnh, bạn xem kết quả.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}>
                {/* Render the reply with line breaks */}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {/* Action results */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                    {m.actions.map((a, j) => (
                      <div key={j} className={`rounded p-2 text-xs ${
                        a.ok ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'
                      }`}>
                        <p className="flex items-center gap-1 font-semibold">
                          {a.kind === 'write_file' && <><FileEdit className="h-3 w-3" /> Sửa file: {a.target}</>}
                          {a.kind === 'run_shell' && <><Terminal className="h-3 w-3" /> Lệnh: <code>{a.target}</code></>}
                          {a.kind === 'explanation' && <><Bot className="h-3 w-3" /> {a.output}</>}
                          {!a.ok && <span className="ml-auto text-rose-600">FAIL</span>}
                          {a.ok && a.kind !== 'explanation' && <span className="ml-auto text-emerald-600">OK</span>}
                        </p>
                        {a.target && a.kind !== 'explanation' && (
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">{a.output}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> AI đang xử lý…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mô tả task cho AI (vd: fix hydration bug trong home-view, thêm tính năng X, chạy lint...)"
          rows={2}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="gap-1.5 self-end">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gửi
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        ⚠️ AI có quyền sửa code + chạy lệnh. Mọi action được log vào SystemLog (Admin → Logs). Nhấn Cmd/Ctrl+Enter để gửi nhanh.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Update Log tab — super-admin only. Lists all file backups created by
 * the AI Dev Agent. Each backup can be restored (1 click) to undo an AI
 * edit that broke something.
 * ------------------------------------------------------------------------- */
interface BackupEntry {
  filename: string
  backupPath: string
  originalPath: string
  timestamp: string
  size: number
  preview: string
}

function UpdateLogTab() {
  const qc = useQueryClient()
  const [restoring, setRestoring] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: backups, isLoading } = useQuery<BackupEntry[]>({
    queryKey: ['web-update-log'],
    queryFn: () => api.get('/api/admin/web-update-log'),
  })

  const restore = async (entry: BackupEntry) => {
    if (!confirm(`Khôi phục file "${entry.originalPath}" về phiên bản cũ?\nFile hiện tại sẽ được backup lại trước khi restore.`)) return
    setRestoring(entry.backupPath)
    try {
      const data = await api.post<{ message: string; restoredPath: string }>(
        '/api/admin/web-update-log',
        { backupPath: entry.backupPath }
      )
      toast.success(data.message || `Đã khôi phục ${data.restoredPath}`)
      await qc.invalidateQueries({ queryKey: ['web-update-log'] })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Khôi phục thất bại')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" /> Nhật ký cập nhật web
            <Badge className="bg-amber-500/15 text-amber-700 text-[10px] dark:text-amber-300">SUPER ADMIN</Badge>
          </CardTitle>
          <CardDescription>
            Mỗi khi AI Dev Agent sửa file, bản cũ được backup tự động. Xem lịch sử + khôi phục nếu AI sửa sai.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card><CardContent className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent></Card>
      ) : !backups || backups.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <History className="mx-auto mb-2 h-10 w-10 opacity-50" />
          <p className="font-medium">Chưa có backup nào</p>
          <p className="mt-1 text-xs">Backup tự động tạo khi AI Dev Agent sửa file. Sử dụng tab AI Dev Agent để bắt đầu.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <Card key={b.filename}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <FileEdit className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-semibold">{b.originalPath}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {(b.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {b.timestamp.replace(/-/g, (m: string, i: number) => i < 2 ? '/' : i === 2 ? ' ' : ':').replace(/-(\d{2})$/, ':$1')}
                    </p>

                    {/* Expand to preview old content */}
                    {expanded === b.filename && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-[10px] whitespace-pre-wrap">
                        {b.preview}{'...' }
                      </pre>
                    )}

                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setExpanded(expanded === b.filename ? null : b.filename)}
                      >
                        {expanded === b.filename ? 'Ẩn' : 'Xem nội dung cũ'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                        onClick={() => restore(b)}
                        disabled={restoring === b.backupPath}
                      >
                        {restoring === b.backupPath ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Đang khôi phục…</>
                        ) : (
                          <><RotateCcw className="h-3 w-3" /> Khôi phục</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-muted-foreground">
        Backups lưu tại <code>.backups/</code> trong project root. Tối đa 50 entries hiển thị. Restore tạo backup mới cho file hiện tại trước khi ghi đè — có thể undo restore.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Access denied screen
 * ------------------------------------------------------------------------- */
function AccessDenied() {
  const setUser = useAuthStore((s) => s.setUser)
  const setView = useUIStore.getState().setView
  const [loading, setLoading] = useState(false)

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Trang quản trị Nội Thất AVH</CardTitle>
          <CardDescription>
            Đây là khu vực dành cho quản trị viên. Vui lòng đăng nhập bằng tài khoản quản trị để truy cập bảng điều khiển.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setView('shop')}>
            Về trang cửa hàng
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              document.querySelector<HTMLButtonElement>('[aria-label="Tài khoản"]')?.click()
            }
          >
            Đăng nhập quản trị
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Nếu quên mật khẩu, liên hệ giám đốc cửa hàng để được cấp lại.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Overview tab
 * ------------------------------------------------------------------------- */
function OverviewTab() {
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/api/admin/stats'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error instanceof ApiError ? error.message : 'Không tải được dữ liệu tổng quan.'}
        </CardContent>
      </Card>
    )
  }

  const kpis = [
    {
      label: 'Doanh thu',
      value: formatVND(stats.revenue),
      icon: DollarSign,
      tone: 'bg-emerald-500/10 text-emerald-600',
      trend: <TrendingUp className="h-3.5 w-3.5" />,
    },
    {
      label: 'Đơn hàng',
      value: stats.orders.toLocaleString('vi-VN'),
      icon: ShoppingBag,
      tone: 'bg-amber-500/10 text-amber-600',
      trend: <TrendingUp className="h-3.5 w-3.5" />,
    },
    {
      label: 'Sản phẩm',
      value: stats.products.toLocaleString('vi-VN'),
      icon: Package,
      tone: 'bg-primary/10 text-primary',
      trend: null,
    },
    {
      label: 'Khách hàng',
      value: stats.customers.toLocaleString('vi-VN'),
      icon: Users,
      tone: 'bg-slate-500/10 text-slate-600',
      trend: null,
    },
  ]

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-xl font-bold">{k.value}</p>
                {k.trend && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                    {k.trend} so với kỳ trước
                  </p>
                )}
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.tone}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Doanh thu 7 ngày
            </CardTitle>
            <CardDescription className="text-xs">
              Tổng doanh thu và số đơn hàng theo ngày
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}tr` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'revenue'
                        ? [formatVND(value), 'Doanh thu']
                        : [`${value} đơn`, 'Đơn hàng']
                    }
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}
                  />
                  <Legend
                    formatter={(v) => (v === 'revenue' ? 'Doanh thu' : 'Đơn hàng')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#c2654a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="orders" stroke="#7a8b5a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <LayoutDashboard className="h-4 w-4 text-primary" /> Sản phẩm theo danh mục
            </CardTitle>
            <CardDescription className="text-xs">
              Số lượng sản phẩm đang hoạt động
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryBreakdown} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={0} angle={-15} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [`${v} sản phẩm`, 'Số lượng']}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}
                  />
                  <Bar dataKey="productCount" fill="#c2654a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: recent orders, low stock, top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Đơn gần đây</CardTitle>
            <CardDescription className="text-xs">
              5 đơn hàng mới nhất cần xử lý
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {stats.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">#{o.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('vi-VN')} · {o.itemCount} SP
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatVND(o.total)}</span>
                    <Badge className={STATUS_BADGE_CLASSES[o.status] ?? 'bg-slate-100 text-slate-700'} variant="outline">
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Alerts: pending + low stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cảnh báo</CardTitle>
            <CardDescription className="text-xs">Cần xử lý gấp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Đơn chờ xác nhận</p>
                  <p className="text-xs text-muted-foreground">Cần liên hệ khách hàng</p>
                </div>
              </div>
              <span className="text-lg font-bold text-amber-600">{stats.pendingOrders}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-50 p-3 dark:bg-red-950/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Sắp hết hàng</p>
                  <p className="text-xs text-muted-foreground">Biến thể ≤ 5 tồn</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-600">{stats.lowStock}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Star className="h-4 w-4 text-primary" /> Top sản phẩm bán chạy
          </CardTitle>
          <CardDescription className="text-xs">
            Doanh thu = số đã bán × giá gốc
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.topProducts.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
              >
                <span className="w-6 shrink-0 text-center text-lg font-bold text-primary/30">
                  {i + 1}
                </span>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.image && (
                    <Image src={p.image} alt={p.name} fill sizes="48px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Đã bán {p.sold.toLocaleString('vi-VN')}
                  </p>
                </div>
                <p className="text-sm font-semibold text-primary">{formatVND(p.revenue)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Products tab
 * ------------------------------------------------------------------------- */
function ProductsTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, error } = useQuery<{ items: AdminProduct[] }>({
    queryKey: ['products', 'admin', 'all'],
    queryFn: () => api.get('/api/products?limit=60&page=1'),
  })

  const filtered = useMemo(() => {
    if (!data?.items) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.items
    return data.items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q)
    )
  }, [data, search])

  const handleToggleFlag = async (
    p: AdminProduct,
    field: 'isFeatured' | 'isFlashSale',
    value: boolean
  ) => {
    try {
      await api.patch(`/api/admin/products?id=${p.id}`, { [field]: value })
      await qc.refetchQueries()
      toast.success(`Đã ${value ? 'bật' : 'tắt'} ${field === 'isFeatured' ? 'nổi bật' : 'flash sale'}`, {
        description: p.name,
      })
    } catch (e) {
      toast.error('Cập nhật thất bại', {
        description: e instanceof ApiError ? e.message : 'Lỗi không xác định',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.del(`/api/admin/products?id=${deleteTarget.id}`)
      // Invalidate ALL queries so no stale product data remains anywhere:
      // homepage (featured/flashSale/new/best), categories count, admin stats,
      // cart validation, chat context, etc.
      await qc.refetchQueries()
      toast.success('Đã gỡ sản phẩm', { description: deleteTarget.name })
      setDeleteTarget(null)
    } catch (e) {
      toast.error('Xoá thất bại', {
        description: e instanceof ApiError ? e.message : 'Lỗi không xác định',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Quản lý sản phẩm</h2>
          <p className="text-xs text-muted-foreground">
            {data?.items ? `${filtered.length} / ${data.items.length} sản phẩm` : 'Đang tải…'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên / danh mục…"
              className="pl-9"
              aria-label="Tìm sản phẩm"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Thêm
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-destructive">
              {error instanceof ApiError ? error.message : 'Không tải được sản phẩm.'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Không có sản phẩm phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ảnh</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="hidden sm:table-cell">Danh mục</TableHead>
                    <TableHead className="text-right">Giá</TableHead>
                    <TableHead className="text-center">Nổi bật</TableHead>
                    <TableHead className="text-center">Flash</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted">
                          {p.image && (
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.brand}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{p.category?.name ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatVND(p.basePrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={!!p.isFeatured}
                          onCheckedChange={(v) => handleToggleFlag(p, 'isFeatured', v)}
                          aria-label="Nổi bật"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={!!p.isFlashSale}
                          onCheckedChange={(v) => handleToggleFlag(p, 'isFlashSale', v)}
                          aria-label="Flash sale"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditing(p)
                              setDialogOpen(true)
                            }}
                            aria-label="Sửa sản phẩm"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Xoá sản phẩm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá sản phẩm?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ gỡ sản phẩm <strong>{deleteTarget?.name}</strong> khỏi cửa hàng (xoá mềm).
              Khách hàng sẽ không còn thấy sản phẩm, nhưng dữ liệu vẫn được lưu trong hệ thống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Đang xoá…' : 'Xoá sản phẩm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Product create/edit dialog
 * ------------------------------------------------------------------------- */
function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: AdminProduct | null
}) {
  const qc = useQueryClient()
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories'),
  })

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('AVH Home')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [stock, setStock] = useState('0')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isFlashSale, setIsFlashSale] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Pre-fill when opening
  useEffect(() => {
    if (!open) return
    if (product) {
      setName(product.name)
      setBrand(product.brand || 'AVH Home')
      setBasePrice(String(product.basePrice))
      setComparePrice(product.comparePrice ? String(product.comparePrice) : '')
      setMedia(product.image ? [{ url: product.image, type: 'image' as const, name: 'existing' }] : [])
      setCategoryId(product.category?.id || '')
      setIsFeatured(!!product.isFeatured)
      setIsFlashSale(!!product.isFlashSale)
      setIsNew(!!product.isNew)
      setDescription('')
      setStock('0')
    } else {
      setName('')
      setBrand('AVH Home')
      setBasePrice('')
      setComparePrice('')
      setMedia([])
      setCategoryId(categories?.[0]?.id || '')
      setIsFeatured(false)
      setIsFlashSale(false)
      setIsNew(false)
      setDescription('')
      setStock('0')
    }
    setResetKey((k) => k + 1)
  }, [open, product, categories])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !categoryId || !basePrice) {
      toast.error('Vui lòng nhập tên, danh mục và giá')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        brand: brand.trim() || 'AVH Home',
        description: description.trim(),
        basePrice: Number(basePrice),
        comparePrice: comparePrice ? Number(comparePrice) : null,
        media: media.map((m) => ({ url: m.url, type: m.type })),
        imageUrl: media[0]?.url, // backward-compat fallback
        stock: Number(stock) || 0,
        isFeatured,
        isFlashSale,
        isNew,
      }
      if (product) {
        await api.patch(`/api/admin/products?id=${product.id}`, payload)
        toast.success('Đã cập nhật sản phẩm')
      } else {
        await api.post('/api/admin/products', payload)
        toast.success('Đã tạo sản phẩm mới')
      }
      await qc.refetchQueries()
      onOpenChange(false)
    } catch (err) {
      toast.error('Lưu thất bại', {
        description: err instanceof ApiError ? err.message : 'Lỗi không xác định',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Cập nhật thông tin cơ bản. Mọi thay đổi sẽ áp dụng ngay.'
              : 'Tạo một sản phẩm mới với một biến thể mặc định.'}
          </DialogDescription>
        </DialogHeader>
        <form key={resetKey} onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Tên sản phẩm *</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Sofa góc linen AVC-200"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-cat">Danh mục *</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger id="pf-cat">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-brand">Thương hiệu</Label>
              <Input
                id="pf-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-price">Giá bán (₫) *</Label>
              <Input
                id="pf-price"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                min={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-cmp">Giá gốc (tuỳ chọn)</Label>
              <Input
                id="pf-cmp"
                type="number"
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value)}
                min={0}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">Tồn kho</Label>
              <Input
                id="pf-stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min={0}
                disabled={!!product}
              />
              {product && (
                <p className="text-[11px] text-muted-foreground">
                  Tồn kho quản lý theo biến thể, không sửa ở đây.
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ảnh & video sản phẩm</Label>
              <MediaUploader media={media} onChange={setMedia} />
              <p className="text-[11px] text-muted-foreground">
                Kéo thả hoặc bấm để chọn nhiều ảnh/video cùng lúc. Hỗ trợ JPG, PNG, WebP, GIF (≤8MB) và MP4, WebM (≤25MB).
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Mô tả ngắn</Label>
            <Textarea
              id="pf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isFeatured} onCheckedChange={(v) => setIsFeatured(!!v)} />
              Nổi bật
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isFlashSale} onCheckedChange={(v) => setIsFlashSale(!!v)} />
              Flash sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isNew} onCheckedChange={(v) => setIsNew(!!v)} />
              Hàng mới
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu…' : product ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------------------
 * Orders tab
 * ------------------------------------------------------------------------- */
function OrdersTab() {
  const qc = useQueryClient()
  const [codeSearch, setCodeSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchedOrder, setSearchedOrder] = useState<OrderDetail | null>(null)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)

  // Recent orders come from stats endpoint
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/api/admin/stats'),
  })

  const handleSearchByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = codeSearch.trim().toUpperCase()
    if (!code) return
    setSearching(true)
    setSearchedOrder(null)
    try {
      const order = await api.get<OrderDetail>(`/api/orders/${encodeURIComponent(code)}`)
      setSearchedOrder(order)
      setExpandedCode(order.code)
      toast.success(`Tìm thấy đơn ${order.code}`)
    } catch (err) {
      toast.error('Không tìm thấy đơn hàng', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    } finally {
      setSearching(false)
    }
  }

  const handleStatusChange = async (code: string, status: string) => {
    setStatusUpdating(code)
    try {
      await api.patch(`/api/orders/${encodeURIComponent(code)}`, { status })
      await qc.refetchQueries()
      if (searchedOrder?.code === code) {
        setSearchedOrder({ ...searchedOrder, status })
      }
      toast.success(`Đã cập nhật đơn ${code}: ${ORDER_STATUS_LABELS[status]}`)
    } catch (err) {
      toast.error('Cập nhật trạng thái thất bại', {
        description: err instanceof ApiError ? err.message : undefined,
      })
    } finally {
      setStatusUpdating(null)
    }
  }

  const clearSearch = () => {
    setSearchedOrder(null)
    setCodeSearch('')
    setExpandedCode(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Quản lý đơn hàng</h2>
          <p className="text-xs text-muted-foreground">
            Tìm theo mã đơn hoặc xem các đơn gần nhất.
          </p>
        </div>
        <form onSubmit={handleSearchByCode} className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              placeholder="AVH-XXXXXX"
              className="w-44 pl-9 uppercase"
              aria-label="Tìm theo mã đơn"
            />
          </div>
          <Button type="submit" disabled={searching} className="gap-1.5">
            <Search className="h-4 w-4" /> {searching ? 'Đang tìm…' : 'Tìm'}
          </Button>
        </form>
      </div>

      {searchedOrder && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">
                Đơn tìm được: #{searchedOrder.code}
              </CardTitle>
              <CardDescription className="text-xs">
                {searchedOrder.shippingName} · {searchedOrder.shippingPhone}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              Xoá kết quả
            </Button>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading && !searchedOrder ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : searchedOrder ? (
            <OrderDetailBlock
              order={searchedOrder}
              expanded
              onToggle={() => {}}
              onStatusChange={handleStatusChange}
              statusUpdating={statusUpdating === searchedOrder.code}
            />
          ) : stats?.recentOrders?.length ? (
            <div className="divide-y divide-border/60">
              {stats.recentOrders.map((o) => (
                <OrderRow
                  key={o.id}
                  code={o.code}
                  total={o.total}
                  status={o.status}
                  paymentStatus={o.paymentStatus}
                  paymentMethod={o.paymentMethod}
                  shippingName={o.shippingName}
                  itemCount={o.itemCount}
                  createdAt={o.createdAt}
                  expanded={expandedCode === o.code}
                  onToggle={() =>
                    setExpandedCode((c) => (c === o.code ? null : o.code))
                  }
                  onStatusChange={handleStatusChange}
                  statusUpdating={statusUpdating === o.code}
                />
              ))}
              <div className="p-3 text-center text-xs text-muted-foreground">
                Đang hiển thị các đơn gần nhất. Dùng ô tìm kiếm để tra cứu đơn khác.
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Chưa có đơn hàng nào.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OrderRow({
  code,
  total,
  status,
  paymentStatus,
  paymentMethod,
  shippingName,
  itemCount,
  createdAt,
  expanded,
  onToggle,
  onStatusChange,
  statusUpdating,
}: {
  code: string
  total: number
  status: string
  paymentStatus?: string
  paymentMethod?: string
  shippingName?: string
  itemCount: number
  createdAt: string
  expanded: boolean
  onToggle: () => void
  onStatusChange: (code: string, status: string) => void
  statusUpdating: boolean
}) {
  return (
    <OrderDetailBlock
      order={{
        id: code,
        code,
        status,
        total,
        paymentStatus: paymentStatus || '',
        paymentMethod: paymentMethod || '',
        shippingName: shippingName || '',
        itemCount,
        createdAt,
      } as unknown as OrderDetail}
      expanded={expanded}
      onToggle={onToggle}
      onStatusChange={onStatusChange}
      statusUpdating={statusUpdating}
      minimal
    />
  )
}

function OrderDetailBlock({
  order,
  expanded,
  onToggle,
  onStatusChange,
  statusUpdating,
  minimal = false,
}: {
  order: OrderDetail
  expanded: boolean
  onToggle: () => void
  onStatusChange: (code: string, status: string) => void
  statusUpdating: boolean
  minimal?: boolean
}) {
  const { data: full, isFetching } = useQuery<OrderDetail>({
    queryKey: ['order', order.code],
    queryFn: () => api.get(`/api/orders/${encodeURIComponent(order.code)}`),
    enabled: expanded && !!(order as any).itemCount && minimal,
  })

  const detail = minimal ? full ?? order : order

  return (
    <div className="border-b border-border/60 last:border-b-0">
      {/* Row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-accent/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition ${expanded ? 'rotate-90' : ''}`}
          />
          <div className="min-w-0">
            <p className="font-medium">#{order.code}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleString('vi-VN')}
              {' · '}
              {!minimal && order.shippingName ? order.shippingName : `${(order as any).itemCount ?? 0} SP`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-sm font-semibold">{formatVND(order.total)}</span>
          {/* Payment status badge — gives admin an at-a-glance view of which
              orders are paid vs pending vs unpaid, so they don't have to open
              each order to know if money has arrived. */}
          {order.paymentStatus === 'PAID' && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950/40 dark:text-emerald-300">
              Đã thanh toán
            </Badge>
          )}
          {order.paymentStatus === 'PENDING_VERIFY' && (
            <Badge className="bg-amber-100 text-amber-700 text-[10px] dark:bg-amber-950/40 dark:text-amber-300">
              Chờ xác nhận TT
            </Badge>
          )}
          {order.paymentStatus === 'UNPAID' && (
            <Badge className="bg-slate-100 text-slate-600 text-[10px] dark:bg-slate-800/60 dark:text-slate-300">
              Chưa thanh toán
            </Badge>
          )}
          {order.paymentStatus === 'REFUNDED' && (
            <Badge className="bg-rose-100 text-rose-700 text-[10px] dark:bg-rose-950/40 dark:text-rose-300">
              Đã hoàn tiền
            </Badge>
          )}
          {/* Order status badge (separate from payment status — this is
              fulfilment status: pending/processing/shipping/delivered/...) */}
          <Badge
            className={STATUS_BADGE_CLASSES[order.status] ?? 'bg-slate-100 text-slate-700'}
            variant="outline"
          >
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
          {isFetching ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : !detail ? null : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left: items + customer info */}
              <div className="space-y-3">
                {!minimal && (
                  <div className="rounded-lg border bg-card p-3 text-xs">
                    <p className="text-xs font-semibold">Thông tin khách hàng</p>
                    <p className="mt-1 text-foreground/80">{order.shippingName}</p>
                    <p className="text-muted-foreground">{order.shippingPhone}</p>
                    <p className="text-muted-foreground">{order.shippingAddress}</p>
                    {order.voucherCode && (
                      <p className="mt-1 text-muted-foreground">Voucher: {order.voucherCode}</p>
                    )}
                    {order.note && (
                      <p className="mt-1 text-muted-foreground">Ghi chú: {order.note}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold">
                    Sản phẩm ({detail.items?.length ?? (order as any).itemCount ?? 0})
                  </p>
                  {detail.items?.length ? (
                    <ul className="space-y-2">
                      {detail.items.map((it) => (
                        <li key={it.id} className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {it.image && (
                              <Image src={it.image} alt={it.name} fill sizes="40px" className="object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-xs font-medium">{it.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {it.quantity} × {formatVND(it.unitPrice)}
                            </p>
                          </div>
                          <p className="text-xs font-semibold">
                            {formatVND(it.unitPrice * it.quantity)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {(order as any).itemCount ?? 0} sản phẩm
                    </p>
                  )}
                </div>
              </div>

              {/* Right: status control + timeline */}
              <div className="space-y-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold">Cập nhật trạng thái</p>
                  <Select
                    value={order.status}
                    onValueChange={(v) => onStatusChange(order.code, v)}
                    disabled={statusUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ORDER_STATUS_LABELS)
                        .filter(([k]) => k !== 'REFUNDED')
                        .map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {statusUpdating && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Đang cập nhật…</p>
                  )}
                </div>

                {detail.timeline?.length > 0 && (
                  <div className="rounded-lg border bg-card p-3">
                    <p className="mb-2 text-xs font-semibold">Lịch sử trạng thái</p>
                    <ol className="relative space-y-3 border-l border-border/60 pl-3">
                      {detail.timeline.map((t, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[14px] top-1 h-2 w-2 rounded-full bg-primary" />
                          <p className="text-xs font-medium">
                            {ORDER_STATUS_LABELS[t.status] ?? t.status}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(t.at).toLocaleString('vi-VN')}
                          </p>
                          {t.note && (
                            <p className="text-[11px] text-muted-foreground italic">
                              "{t.note}"
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Promotions tab
 * ------------------------------------------------------------------------- */
function PromotionsTab() {
  const qc = useQueryClient()
  const { data: vouchers, isLoading } = useQuery<Voucher[]>({
    queryKey: ['vouchers', 'all'],
    queryFn: () => api.get('/api/vouchers'),
  })
  const { data: banners } = useQuery<Banner[]>({
    queryKey: ['banners'],
    queryFn: () => api.get('/api/banners'),
  })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '', description: '', type: 'PERCENT', value: 10,
    minOrder: 0, maxDiscount: 0, usageLimit: 100,
    startAt: '', endAt: '', active: true,
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const startCreate = () => {
    setEditId(null)
    setForm({
      code: '', description: '', type: 'PERCENT', value: 10,
      minOrder: 0, maxDiscount: 0, usageLimit: 100,
      startAt: new Date().toISOString().slice(0, 10),
      endAt: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      active: true,
    })
    setShowForm(true)
  }
  const startEdit = (v: Voucher) => {
    setEditId(v.id)
    setForm({
      code: v.code, description: v.description || '', type: v.type, value: v.value,
      minOrder: v.minOrder || 0, maxDiscount: v.maxDiscount || 0, usageLimit: v.usageLimit || 0,
      startAt: new Date(v.startAt).toISOString().slice(0, 10),
      endAt: new Date(v.endAt).toISOString().slice(0, 10),
      active: v.active,
    })
    setShowForm(true)
  }
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim()) { toast.error('Nhập mã voucher'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().trim(),
        value: Number(form.value),
        minOrder: Number(form.minOrder),
        maxDiscount: form.type === 'PERCENT' || form.type === 'FREE_SHIP' ? Number(form.maxDiscount) || null : null,
        usageLimit: Number(form.usageLimit),
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
      }
      if (editId) {
        await api.patch(`/api/admin/vouchers?id=${editId}`, payload)
        toast.success('Đã cập nhật voucher')
      } else {
        await api.post('/api/admin/vouchers', payload)
        toast.success(`Đã tạo voucher ${form.code.toUpperCase()}`)
      }
      setShowForm(false)
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại')
    } finally { setSaving(false) }
  }
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.del(`/api/admin/vouchers?id=${deleteId}`)
      toast.success('Đã xoá voucher')
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xoá thất bại')
    } finally { setDeleteId(null) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Khuyến mãi</h2>
          <p className="text-xs text-muted-foreground">Mã giảm giá & banner flash sale</p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => showForm ? setShowForm(false) : startCreate()}>
          <Plus className="h-4 w-4" /> {showForm ? 'Đóng' : 'Tạo voucher'}
        </Button>
      </div>

      {/* Create/Edit voucher form */}
      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleSave} className="space-y-3">
            <h3 className="text-sm font-semibold">{editId ? 'Sửa voucher' : 'Tạo voucher mới'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mã voucher *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="AVH10, FREESHIP..." />
              </div>
              <div className="space-y-1.5">
                <Label>Loại *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Giảm % (theo phần trăm)</SelectItem>
                    <SelectItem value="FIXED">Giảm số tiền cố định (VNĐ)</SelectItem>
                    <SelectItem value="FREE_SHIP">Miễn phí ship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{form.type === 'PERCENT' ? 'Phần trăm giảm (%)' : form.type === 'FREE_SHIP' ? 'Giá trị (phí ship tối đa)' : 'Số tiền giảm (VNĐ)'}</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Đơn tối thiểu (VNĐ)</Label>
                <Input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} placeholder="0" />
              </div>
              {(form.type === 'PERCENT' || form.type === 'FREE_SHIP') && (
                <div className="space-y-1.5">
                  <Label>Giảm tối đa (VNĐ) {form.type === 'FREE_SHIP' ? '(= phí ship tối đa miễn)' : '(cho PERCENT)'}</Label>
                  <Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} placeholder="0 = không giới hạn" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Số lần dùng tối đa (0 = unlimited)</Label>
                <Input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày bắt đầu</Label>
                <Input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày kết thúc</Label>
                <Input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Giảm 10% cho đơn từ 3 triệu" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editId ? 'Cập nhật' : 'Tạo voucher'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Huỷ</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Vouchers list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mã giảm giá đang hoạt động</CardTitle>
          <CardDescription className="text-xs">
            {vouchers?.length ?? 0} voucher
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !vouchers?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có voucher nào.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Giá trị</TableHead>
                    <TableHead className="text-right">Đã dùng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {v.code}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {v.type === 'PERCENT' ? 'Giảm %' : v.type === 'FREE_SHIP' ? 'Free Ship' : '₫'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {v.type === 'PERCENT' ? `${v.value}%` : v.type === 'FREE_SHIP' ? `≤ ${formatVND(v.maxDiscount || v.value)}` : formatVND(v.value)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {v.usedCount ?? 0}
                        {v.usageLimit ? ` / ${v.usageLimit}` : ''}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={v.active} disabled aria-label="Kích hoạt" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(v)} aria-label="Sửa">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(v.id)} aria-label="Xoá">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Banner flash sale</CardTitle>
          <CardDescription className="text-xs">
            Quản lý banner hiển thị ở trang chủ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!banners?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có banner nào.
            </p>
          ) : (
            <ul className="space-y-2">
              {banners.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
                >
                  <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    {b.imageUrl && (
                      <Image
                        src={b.imageUrl}
                        alt={b.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{b.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.active ? 'Đang hiển thị' : 'Đang ẩn'}
                    </p>
                  </div>
                  <Switch checked={b.active} disabled aria-label="Kích hoạt banner" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Reviews tab (placeholder)
 * ------------------------------------------------------------------------- */
function ReviewsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Star className="h-4 w-4 text-primary" /> Quản lý đánh giá
        </CardTitle>
        <CardDescription>
          Quản lý đánh giá — tính năng sẽ ra mắt trong phiên bản kế tiếp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <Star className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Chưa có đánh giá nào để duyệt</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Khi khách hàng gửi đánh giá sản phẩm, bạn sẽ thấy danh sách chờ duyệt tại đây.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * Settings tab — full site configuration (branding, contact, social,
 * announcement bar, shipping policy, footer).
 * ------------------------------------------------------------------------- */

// group id -> icon mapping (mirrors lib/settings.ts SETTING_GROUPS)
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  branding: Store,
  contact: Phone,
  social: Share2,
  announcement: Megaphone,
  shipping: Truck,
  payment: CreditCard,
  footer: AlignLeft,
}
const GROUP_LABELS: Record<string, string> = {
  branding: 'Thương hiệu',
  contact: 'Liên hệ',
  social: 'Mạng xã hội',
  announcement: 'Quảng cáo header',
  shipping: 'Chính sách giao hàng',
  payment: 'Thanh toán & Ngân hàng',
  footer: 'Footer',
}

interface SettingDef {
  key: string
  label: string
  group: string
  type: 'text' | 'textarea' | 'url' | 'number' | 'image' | 'boolean'
  defaultValue: string
  placeholder?: string
  help?: string
}

function SettingsTab() {
  const qc = useQueryClient()
  const setSettings = useSettingsStore((s) => s.set)
  const [activeGroup, setActiveGroup] = useState<string>('branding')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery<{ values: Record<string, string>; defs: SettingDef[] }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/admin/settings'),
  })

  // populate draft when data arrives
  useEffect(() => {
    if (data?.values) {
      setDraft({ ...data.values })
      setDirty(false)
      // also update the live settings store so header/footer reflect
      setSettings(data.values)
    }
  }, [data, setSettings])

  const defs = data?.defs || []
  const groupDefKeys = defs.filter((d) => d.group === activeGroup)

  const update = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // send only changed keys
      const changed: Record<string, string> = {}
      for (const d of defs) {
        if (draft[d.key] !== data?.values[d.key]) {
          changed[d.key] = draft[d.key]
        }
      }
      if (!Object.keys(changed).length) {
        toast.info('Không có thay đổi để lưu')
        setSaving(false)
        return
      }
      await api.post('/api/admin/settings', { values: changed })
      // refresh live store + cache
      setSettings({ ...data?.values, ...changed })
      await qc.invalidateQueries({ queryKey: ['settings'] })
      setDirty(false)
      toast.success(`Đã lưu ${Object.keys(changed).length} thay đổi`, {
        description: 'Cập nhật sẽ hiển thị ngay trên header/footer.',
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const groups = Array.from(new Set(defs.map((d) => d.group)))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Settings className="h-4 w-4 text-primary" /> Cài đặt website
        </CardTitle>
        <CardDescription>
          Mọi thiết lập ở đây — logo, hotline, link Facebook/Zalo, quảng cáo header, chính sách giao hàng, footer —
          đều cập nhật trực tiếp lên website sau khi lưu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* group nav */}
          <nav className="flex flex-wrap gap-1.5 md:flex-col">
            {groups.map((g) => {
              const Icon = GROUP_ICONS[g] || Settings
              const active = activeGroup === g
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {GROUP_LABELS[g] || g}
                </button>
              )
            })}
          </nav>

          {/* group fields */}
          <div className="space-y-4">
            {groupDefKeys.map((def) => (
              <SettingField key={def.key} def={def} value={draft[def.key] ?? ''} onChange={(v) => update(def.key, v)} />
            ))}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !dirty} className="gap-1.5">
                <Save className="h-4 w-4" />
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
              {dirty && <span className="text-xs text-amber-600">● Có thay đổi chưa lưu</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SettingField({
  def,
  value,
  onChange,
}: {
  def: SettingDef
  value: string
  onChange: (v: string) => void
}) {
  const id = `set-${def.key}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{def.label}</Label>
      {/* Special-case: bank accounts → render a proper manager UI instead of raw JSON */}
      {def.key === 'payment_bank_accounts' ? (
        <BankAccountManager value={value} onChange={onChange} />
      ) : def.type === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={def.placeholder}
        />
      ) : def.type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <Switch checked={value === 'true'} onCheckedChange={(v) => onChange(v ? 'true' : 'false')} />
          <span className="text-xs text-muted-foreground">{value === 'true' ? 'Bật' : 'Tắt'}</span>
        </div>
      ) : def.type === 'image' ? (
        <div className="flex gap-2">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.placeholder || 'URL hoặc upload bên phải'}
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-muted px-3 text-xs font-medium hover:bg-accent">
            <ImageIcon className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const fd = new FormData()
                fd.append('files', f)
                try {
                  const res = await fetch('/api/upload', { method: 'POST', body: fd })
                  const b = await res.json()
                  if (b?.success && b.data.uploaded[0]) {
                    onChange(b.data.uploaded[0].url)
                    toast.success('Đã upload logo')
                  } else {
                    toast.error(b?.error || 'Upload thất bại')
                  }
                } catch {
                  toast.error('Upload thất bại')
                }
                e.target.value = ''
              }}
            />
          </label>
          {value && <img src={value} alt="preview" className="h-9 w-9 rounded border object-contain" />}
        </div>
      ) : def.type === 'number' ? (
        <Input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />
      ) : def.type === 'url' ? (
        <Input id={id} type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder || 'https://…'} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} />
      )}
      {def.help && <p className="text-[11px] text-muted-foreground">{def.help}</p>}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Flash Sale tab — create/edit/delete flash sales + attach/detach products.
 * ------------------------------------------------------------------------- */
interface FlashSaleRow {
  id: string
  name: string
  startAt: string
  endAt: string
  active: boolean
  productCount: number
  createdAt: string
}

function FlashSaleTab() {
  const qc = useQueryClient()
  const { data: sales, isLoading } = useQuery<FlashSaleRow[]>({
    queryKey: ['flash-sales'],
    queryFn: () => api.get('/api/admin/flash-sale'),
  })
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startAt || !endAt) {
      toast.error('Vui lòng nhập tên + ngày bắt đầu/kết thúc')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/admin/flash-sale', {
        name,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        active: true,
      })
      toast.success('Đã tạo chương trình flash sale')
      setName('')
      setStartAt('')
      setEndAt('')
      setShowForm(false)
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Tạo thất bại')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (fs: FlashSaleRow) => {
    try {
      await api.patch(`/api/admin/flash-sale?id=${fs.id}`, { active: !fs.active })
      toast.success(fs.active ? 'Đã tạm dừng' : 'Đã kích hoạt')
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật thất bại')
    }
  }

  const handleDelete = async (fs: FlashSaleRow) => {
    if (!confirm(`Xoá "${fs.name}"? Sản phẩm trong chương trình sẽ không còn gắn cờ flash sale.`)) return
    try {
      await api.del(`/api/admin/flash-sale?id=${fs.id}`)
      toast.success('Đã xoá flash sale')
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xoá thất bại')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-red-500" /> Quản lý Flash Sale
          </CardTitle>
          <CardDescription>Tạo chương trình giảm giá có giới hạn thời gian và gắn sản phẩm vào.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" /> {showForm ? 'Đóng' : 'Tạo flash sale'}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleCreate} className="mb-4 grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="fs-name">Tên chương trình</Label>
              <Input id="fs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Flash Sale cuối tuần" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-start">Bắt đầu</Label>
              <Input id="fs-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fs-end">Kết thúc</Label>
              <Input id="fs-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Đang tạo…' : 'Tạo mới'}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : !sales?.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Flame className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Chưa có chương trình flash sale nào.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((fs) => {
              const now = Date.now()
              const ended = now > new Date(fs.endAt).getTime()
              const started = now >= new Date(fs.startAt).getTime()
              const running = started && !ended && fs.active
              return (
                <div key={fs.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${running ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'}`}>
                    <Flame className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fs.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(fs.startAt).toLocaleString('vi-VN')} → {new Date(fs.endAt).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-xs text-muted-foreground">{fs.productCount} sản phẩm</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {running ? (
                      <Badge className="bg-red-600 text-white">Đang chạy</Badge>
                    ) : ended ? (
                      <Badge variant="secondary">Đã kết thúc</Badge>
                    ) : !started ? (
                      <Badge variant="outline">Sắp chạy</Badge>
                    ) : (
                      <Badge variant="secondary">Tạm dừng</Badge>
                    )}
                    <Switch checked={fs.active} onCheckedChange={() => toggleActive(fs)} aria-label="Bật/tắt" />
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(fs)} aria-label="Xoá">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Lưu ý: để gán sản phẩm vào flash sale, mở sản phẩm ở tab Sản phẩm và bật ô "Flash sale".
        </p>
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * Bank account manager — lets the admin add/edit/remove real bank accounts
 * with a visual form instead of raw JSON. Each entry has: bank name,
 * account number, holder, branch (optional), QR image (optional).
 * The value is serialized to JSON so it stays compatible with the settings
 * store + checkout's BankTransferInfo component.
 * ------------------------------------------------------------------------- */
interface BankAccount {
  id: string
  bank: string       // display name (e.g. "Vietcombank")
  bankCode: string   // VietQR short code (e.g. "vcb") — used to auto-generate QR
  accountNumber: string
  holder: string
  branch?: string
  qrUrl?: string     // optional custom QR; if absent, auto-generate from VietQR
}

function BankAccountManager({
  value: _value,
  onChange: _onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  // The bank account is FIXED and hardcoded in src/lib/fixed-bank-account.ts.
  // Admins cannot add / edit / delete / change it. This component is now
  // READ-ONLY — it only displays the fixed account info + the auto-generated
  // QR preview. The real enforcement is at the API layer
  // (POST /api/admin/settings rejects `payment_bank_accounts` with 403
  // BANK_ACCOUNT_LOCKED), so even if someone bypasses the UI and calls the
  // API directly, the change is still rejected server-side.

  const qrPreview = buildVietQRUrl({
    bankCode: FIXED_BANK_ACCOUNT.bankCode,
    accountNumber: FIXED_BANK_ACCOUNT.accountNumber,
    accountName: FIXED_BANK_ACCOUNT.holder,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
        {qrPreview ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-white">
            <img src={qrPreview} alt={`QR ${FIXED_BANK_ACCOUNT.bank}`} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <CreditCard className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-sm font-semibold">{FIXED_BANK_ACCOUNT.bank}</p>
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              Fixed / Active
            </span>
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked" />
          </div>
          <p className="font-mono text-base font-bold tracking-wide">{FIXED_BANK_ACCOUNT.accountNumber}</p>
          <p className="text-xs text-muted-foreground">Chủ TK: {FIXED_BANK_ACCOUNT.holder}</p>
          {FIXED_BANK_ACCOUNT.branch && (
            <p className="text-[11px] text-muted-foreground">{FIXED_BANK_ACCOUNT.branch}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tài khoản cố định — không thể thêm/sửa/xoá. Mọi order mới đều dùng tài khoản này.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
        <p className="flex items-center gap-1.5 font-semibold">
          <Lock className="h-3.5 w-3.5" />
          Tài khoản ngân hàng đã khoá
        </p>
        <p className="mt-1">
          Để bảo đảm toàn bộ payment flow (QR + SePay webhook) chỉ chạy với
          một tài khoản duy nhất, hệ thống đã hardcode tài khoản này trong
          mã nguồn. Admin không thể đổi ngân hàng / số tài khoản / chủ TK,
          không thể thêm tài khoản thứ hai, không thể xoá. Mọi attempt qua
          API trực tiếp sẽ bị reject với mã <code>BANK_ACCOUNT_LOCKED</code>.
        </p>
        <p className="mt-1.5">
          Để đổi tài khoản (vd chuyển sang VCB), cần deploy phiên bản code mới
          có <code>FIXED_BANK_ACCOUNT</code> cập nhật trong{' '}
          <code>src/lib/fixed-bank-account.ts</code>.
        </p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Categories tab — add / edit / delete product categories.
 * DELETE is blocked if products exist in the category (server enforces).
 * ------------------------------------------------------------------------- */
function CategoriesTab() {
  const qc = useQueryClient()
  const { data: categories, isLoading } = useQuery<Array<{
    id: string; name: string; slug: string; icon?: string | null
    imageUrl?: string | null; productCount: number
  }>>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories'),
  })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)


  const startAdd = () => { setEditing(null); setName(''); setImageUrl(''); setIcon(''); setShowForm(true) }
  const startEdit = (c: Category) => {
    setEditing(c.id); setName(c.name); setImageUrl(c.imageUrl || ''); setIcon(c.icon || ''); setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Nhập tên danh mục'); return }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/admin/categories?id=${editing}`, { name: name.trim(), imageUrl, icon })
        toast.success('Đã cập nhật danh mục')
      } else {
        await api.post('/api/admin/categories', { name: name.trim(), imageUrl, icon })
        toast.success('Đã thêm danh mục')
      }
      setShowForm(false); setEditing(null)
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lưu thất bại')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.del(`/api/admin/categories?id=${deleteTarget.id}`)
      toast.success('Đã xoá danh mục')
      // Invalidate ALL queries — products in the category were hard-deleted,
      // so stats, homepage, categories count, chat context must all refresh.
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xoá thất bại')
    } finally { setDeleteTarget(null) }
  }

  async function uploadCatImage() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return
      const fd = new FormData(); fd.append('files', f)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const b = await res.json()
        if (b?.success && b.data.uploaded[0]) {
          setImageUrl(b.data.uploaded[0].url)
          toast.success('Đã upload ảnh danh mục')
        } else { toast.error(b?.error || 'Upload thất bại') }
      } catch { toast.error('Upload thất bại') }
    }
    input.click()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <FolderPlus className="h-4 w-4 text-primary" /> Quản lý danh mục
          </CardTitle>
          <CardDescription>Thêm, sửa, xoá danh mục sản phẩm hiển thị ở trang chủ + sidebar.</CardDescription>
        </div>
        <Button size="sm" onClick={() => showForm ? setShowForm(false) : startAdd()} className="gap-1.5">
          <Plus className="h-4 w-4" /> {showForm ? 'Đóng' : 'Thêm danh mục'}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSave} className="mb-4 grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Tên danh mục *</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phòng Khách" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">Icon (tên lucide, tuỳ chọn)</Label>
              <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="VD: sofa, bed, lamp" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ảnh danh mục</Label>
              <div className="flex gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL hoặc upload" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={uploadCatImage} className="gap-1.5 shrink-0">
                  <ImageIcon className="h-3.5 w-3.5" /> Upload
                </Button>
                {imageUrl && <img src={imageUrl} alt="preview" className="h-9 w-9 rounded border object-cover" />}
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Huỷ</Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : !categories?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Chưa có danh mục nào.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" /> : <FolderPlus className="m-auto h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.productCount} sản phẩm</p>
                  <p className="text-[10px] text-muted-foreground">/{c.slug}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)} aria-label="Sửa"><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(c)} aria-label="Xoá"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh mục "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.productCount && deleteTarget.productCount > 0
                ? `⚠️ CẢNH BÁO: Danh mục này còn ${deleteTarget.productCount} sản phẩm. Khi xoá, tất cả sản phẩm sẽ bị XÓA THẬT khỏi hệ thống (không thể khôi phục). Chắc chắn muốn xoá?`
                : 'Hành động này không thể hoàn tác. Danh mục sẽ bị xoá vĩnh viễn.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteTarget?.productCount && deleteTarget.productCount > 0
                ? `Xoá (xoá ${deleteTarget.productCount} sản phẩm)`
                : 'Xoá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * Logs tab — system audit trail (product deletions, order cancellations,
 * payment confirmations, settings changes). Read-only.
 * ------------------------------------------------------------------------- */
interface LogEntry {
  id: string
  level: string
  category: string
  message: string
  detail: string | null
  createdAt: string
}

const LOG_LEVEL_STYLES: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function LogsTab() {
  const [filter, setFilter] = useState<string>('all')
  const { data: logs, isLoading } = useQuery<LogEntry[]>({
    queryKey: ['logs', filter],
    queryFn: () => api.get(`/api/admin/logs?limit=100${filter !== 'all' ? `&category=${filter}` : ''}`),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-primary" /> Nhật ký hệ thống
        </CardTitle>
        <CardDescription>Lịch sử các sự kiện: xoá sản phẩm, huỷ đơn, xác nhận thanh toán, thay đổi cài đặt…</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {['all', 'product', 'order', 'payment', 'settings', 'auth', 'system'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
              }`}
            >
              {f === 'all' ? 'Tất cả' : f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : !logs?.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Chưa có log nào.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 rounded-md border bg-card p-2 text-sm">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${LOG_LEVEL_STYLES[l.level] || 'bg-muted'}`}>
                  {l.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.message}</p>
                  {l.detail && <p className="text-xs text-muted-foreground">{l.detail}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{l.category}</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(l.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * Pending Payments tab — list orders with PENDING_VERIFY payment status.
 * Admin can confirm (mark PAID) or reject (cancel) each order.
 * This is the backup layer for when payment-gateway webhooks fail.
 * ------------------------------------------------------------------------- */
interface PendingPayment {
  id: string
  code: string
  status: string
  paymentStatus: string
  paymentMethod: string
  paymentMethodLabel: string
  total: number
  totalLabel: string
  shippingName: string
  shippingPhone: string
  createdAt: string
  items: Array<{ name: string; quantity: number; image: string }>
  slipUrl: string | null
}

function PendingPaymentsTab() {
  const qc = useQueryClient()
  const [actioning, setActioning] = useState<string | null>(null)
  const { data: pending, isLoading } = useQuery<PendingPayment[]>({
    queryKey: ['pending-payments'],
    queryFn: () => api.get('/api/admin/pending-payments'),
    refetchInterval: 5000, // auto-refresh every 5s
  })

  const confirmPayment = async (code: string) => {
    setActioning(code)
    try {
      await api.post(`/api/orders/${code}/review`, { action: 'confirm', note: 'Admin xác nhận đã nhận tiền' })
      toast.success(`Đã xác nhận ${code}`)
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xác nhận thất bại')
    } finally { setActioning(null) }
  }

  const rejectPayment = async (code: string) => {
    if (!confirm(`Huỷ đơn ${code}? Khách sẽ phải đặt lại.`)) return
    setActioning(code)
    try {
      await api.post(`/api/orders/${code}/review`, { action: 'reject', note: 'Admin từ chối — chưa nhận tiền' })
      toast.success(`Đã huỷ ${code}`)
      await qc.refetchQueries()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Huỷ thất bại')
    } finally { setActioning(null) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-primary" /> Đang chờ thanh toán
        </CardTitle>
        <CardDescription>
          {pending?.length ?? 0} đơn đang chờ khách thanh toán. Admin xác nhận sau khi kiểm tra đã nhận tiền thật.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
        ) : !pending?.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Không có đơn nào đang chờ thanh toán.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                {/* Product image */}
                {p.items[0]?.image && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <img src={p.items[0].image} alt={p.items[0].name} className="h-full w-full object-cover" />
                  </div>
                )}
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-sm">{p.code}</code>
                    <Badge variant="outline" className="text-[10px]">{p.paymentMethodLabel}</Badge>
                    {p.slipUrl && (
                      <Badge className="bg-blue-500 text-white text-[10px]">Có biên lai</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.shippingName} · {p.shippingPhone} · {new Date(p.createdAt).toLocaleString('vi-VN')}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {p.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-primary">{p.totalLabel}</p>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    className="gap-1.5 h-7"
                    onClick={() => confirmPayment(p.code)}
                    disabled={actioning === p.code}
                  >
                    {actioning === p.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Đã nhận tiền
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-destructive"
                    onClick={() => rejectPayment(p.code)}
                    disabled={actioning === p.code}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Huỷ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

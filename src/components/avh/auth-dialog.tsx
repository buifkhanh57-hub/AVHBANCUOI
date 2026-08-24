'use client'

import { useState, useEffect, useMemo } from 'react'
import { signIn } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth-store'
import { toast } from 'sonner'
import { Mail, Apple, Chrome, UserPlus, LogIn, Eye, EyeOff, KeyRound, ArrowLeft, Check } from 'lucide-react'

type Tab = 'signin' | 'signup' | 'forgot'

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  // bonus for length
  if (pw.length >= 12 && score === 4) score = 4
  const labels = ['', 'Yếu', 'Trung bình', 'Khá', 'Mạnh']
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] || '' }
}

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // Note: NextAuth useSession() was removed to fix CLIENT_FETCH_ERROR.
  // Google OAuth uses direct redirect flow (window.location.href = '/api/auth/google')
  // → callback sets JWT cookie → page.tsx reads cookie on mount → calls /api/auth/me
  // → sets user in auth-store. No session polling needed.

  // Reset forgot-tab success flag whenever the dialog is closed or tab changes
  useEffect(() => {
    if (!open) {
      setResetDone(false)
      setNewPw('')
      setConfirmPw('')
    }
  }, [open])

  const pwStrength = useMemo(() => passwordStrength(password), [password])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api.post<{ id: string; name: string; email: string; role: string; token?: string }>(
        '/api/auth/login', { email, password }
      )
      setUser({
        id: data.id, name: data.name, email: data.email,
        role: data.role as 'CUSTOMER' | 'ADMIN' | 'STAFF',
        token: data.token,
      })
      toast.success(`Xin chào ${data.name || data.email}!`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Đăng nhập thất bại')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPw) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      const data = await api.post<{ id: string; name: string | null; email: string; role: string; token?: string }>(
        '/api/auth/register', { email, password, name, phone }
      )
      setUser({
        id: data.id, name: data.name || '', email: data.email,
        role: data.role as 'CUSTOMER' | 'ADMIN' | 'STAFF',
        token: data.token,
      })
      toast.success('Đăng ký thành công! Chào mừng bạn đến với AVH.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Đăng ký thất bại')
    } finally { setLoading(false) }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    setLoading(true)
    try {
      const data = await api.post<{ updated: boolean; message: string }>(
        '/api/auth/reset-password', { email, newPassword: newPw }
      )
      setResetDone(true)
      toast.success(data.message || 'Mật khẩu đã được cập nhật.')
      // switch back to signin tab, prefill email so they can log in immediately
      setPassword('')
      setConfirmPw('')
      setNewPw('')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Đặt lại mật khẩu thất bại')
    } finally { setLoading(false) }
  }

  // REAL Google OAuth — redirects to accounts.google.com
  const handleGoogle = () => {
    window.location.href = '/api/auth/google'
  }
  // REAL Apple Sign In
  const handleApple = () => {
    signIn('apple', { callbackUrl: '/' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {tab === 'forgot' ? 'Đặt lại mật khẩu' : 'Đăng nhập / Đăng ký'}
          </DialogTitle>
          <DialogDescription>
            {tab === 'forgot'
              ? 'Nhập email và mật khẩu mới. Tài khoản quản trị cần liên hệ admin khác để reset.'
              : 'Đăng nhập để đồng bộ giỏ hàng, theo dõi đơn và tích điểm thành viên.'}
          </DialogDescription>
        </DialogHeader>

        {tab === 'forgot' ? (
          resetDone ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm">
                Nếu email <strong>{email}</strong> tồn tại và không phải tài khoản quản trị,
                mật khẩu đã được cập nhật.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => { setResetDone(false); setTab('signin') }}
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-pw">Mật khẩu mới (≥8 ký tự, có chữ + số)</Label>
                <div className="relative">
                  <Input
                    id="reset-pw"
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm">Xác nhận mật khẩu mới</Label>
                <Input
                  id="reset-confirm"
                  type={showNewPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? 'Đang xử lý…' : <><KeyRound className="h-4 w-4" /> Đặt lại mật khẩu</>}
              </Button>
              <button
                type="button"
                onClick={() => setTab('signin')}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Quay lại đăng nhập
              </button>
            </form>
          )
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" /> Đăng nhập
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Đăng ký
              </TabsTrigger>
            </TabsList>

            {/* SIGN IN */}
            <TabsContent value="signin" className="space-y-3 pt-2">
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-pw">Mật khẩu</Label>
                    <button
                      type="button"
                      onClick={() => setTab('forgot')}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="auth-pw"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Đang xử lý…' : 'Đăng nhập'}
                </Button>
              </form>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[11px] text-muted-foreground">HOẶC</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={handleGoogle} className="gap-2">
                  <Chrome className="h-4 w-4" /> Google
                </Button>
                <Button type="button" variant="outline" onClick={handleApple} className="gap-2">
                  <Apple className="h-4 w-4" /> Apple
                </Button>
              </div>
            </TabsContent>

            {/* SIGN UP */}
            <TabsContent value="signup" className="space-y-3 pt-2">
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Họ và tên</Label>
                  <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pw">Mật khẩu (≥8 ký tự, có chữ + số)</Label>
                  <div className="relative">
                    <Input
                      id="reg-pw"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex items-center gap-2 pt-1">
                      <Progress value={pwStrength.score * 25} className="h-1.5 w-24" />
                      <span className="text-[10px] text-muted-foreground">{pwStrength.label}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm">Xác nhận mật khẩu</Label>
                  <Input
                    id="reg-confirm"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  {confirmPw && confirmPw !== password && (
                    <p className="text-[11px] text-destructive">Mật khẩu xác nhận không khớp</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Đang xử lý…' : 'Đăng ký'}
                </Button>
              </form>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[11px] text-muted-foreground">HOẶC</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={handleGoogle} className="gap-2">
                  <Chrome className="h-4 w-4" /> Google
                </Button>
                <Button type="button" variant="outline" onClick={handleApple} className="gap-2">
                  <Apple className="h-4 w-4" /> Apple
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

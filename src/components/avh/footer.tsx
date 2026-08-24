'use client'

import { Phone, Mail, MapPin, Facebook, Instagram, Youtube, Send, ShieldCheck, Truck, CreditCard, HeadphonesIcon, Clock } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState } from 'react'

export function Footer() {
  const setView = useUIStore((s) => s.setView)
  const settings = useSettingsStore()
  const [email, setEmail] = useState('')

  const brandName = settings.get('brand_name')
  const brandTagline = settings.get('brand_tagline')
  const brandLogoUrl = settings.get('brand_logo_url')
  const footerAbout = settings.get('footer_about')
  const footerCopyright = settings.get('footer_copyright')
  const hotline = settings.get('contact_hotline')
  const emailAddr = settings.get('contact_email')
  const address = settings.get('contact_address')
  const workingHours = settings.get('contact_working_hours')
  const facebook = settings.get('social_facebook')
  const zalo = settings.get('social_zalo')
  const instagram = settings.get('social_instagram')
  const youtube = settings.get('social_youtube')
  const tiktok = settings.get('social_tiktok')
  const paymentMethods = settings.get('footer_payment_methods').split(',').map((s) => s.trim()).filter(Boolean)

  // trust badges (text + subtext from settings)
  const badges = [
    { icon: Truck, title: settings.get('shipping_free_text'), desc: settings.get('shipping_free_subtext') },
    { icon: ShieldCheck, title: settings.get('warranty_text'), desc: settings.get('warranty_subtext') },
    { icon: CreditCard, title: 'Thanh toán linh hoạt', desc: paymentMethods.slice(0, 3).join(', ') },
    { icon: HeadphonesIcon, title: settings.get('support_text'), desc: settings.get('support_subtext') },
  ]

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    toast.success('Cảm ơn bạn đã đăng ký nhận tin khuyến mãi!')
    setEmail('')
  }

  const zaloHref = zalo && zalo.startsWith('http') ? zalo : `https://zalo.me/g/${zalo || ''}`

  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      {/* Trust badges strip — all text admin-configurable */}
      <div className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 sm:grid-cols-4 md:gap-6">
          {badges.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-[11px] text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-10 w-auto" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                AVH
              </div>
            )}
            <div>
              <p className="text-sm font-bold tracking-tight">{brandName.toUpperCase()}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{brandTagline}</p>
            </div>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{footerAbout}</p>
          <div className="mt-4 space-y-1.5 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" /> {address}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" /> {hotline}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" /> {emailAddr}
            </p>
            {workingHours && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" /> {workingHours}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent"><Facebook className="h-4 w-4" /></a>
            )}
            {zalo && (
              <a href={zaloHref} target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent text-xs font-bold">Zalo</a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent"><Instagram className="h-4 w-4" /></a>
            )}
            {youtube && (
              <a href={youtube} target="_blank" rel="noopener noreferrer" aria-label="Youtube" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent"><Youtube className="h-4 w-4" /></a>
            )}
            {tiktok && (
              <a href={tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-accent text-xs font-bold">TT</a>
            )}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Về {brandName}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><button className="hover:text-foreground" onClick={() => setView('blog')}>Cẩm nang nội thất</button></li>
            <li><button className="hover:text-foreground">Giới thiệu</button></li>
            <li><button className="hover:text-foreground">Hệ thống cửa hàng</button></li>
            <li><button className="hover:text-foreground">Tuyển dụng</button></li>
            <li><button className="hover:text-foreground" onClick={() => setView('admin')}>🔒 Khu vực quản trị</button></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Hỗ trợ</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><button className="hover:text-foreground" onClick={() => setView('order-tracking')}>Theo dõi đơn hàng</button></li>
            <li><button className="hover:text-foreground">Chính sách bảo hành</button></li>
            <li><button className="hover:text-foreground">Đổi trả & hoàn tiền</button></li>
            <li><button className="hover:text-foreground">Phương thức thanh toán</button></li>
            <li><button className="hover:text-foreground">Câu hỏi thường gặp</button></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Nhận tin khuyến mãi</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Đăng ký để nhận thông báo flash sale và voucher giảm giá.
          </p>
          <form onSubmit={subscribe} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email của bạn"
              className="h-9"
              required
            />
            <Button type="submit" size="sm" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {paymentMethods.map((p) => (
              <span key={p} className="rounded border px-2 py-0.5 text-[10px] text-muted-foreground">{p}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {footerCopyright}</p>
          <p className="flex items-center gap-2">
            <span>Điều khoản dịch vụ</span>
            <span>·</span>
            <span>Chính sách bảo mật</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  Phone,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { useUIStore, ViewName } from '@/lib/stores/ui-store'
import { useCartStore } from '@/lib/stores/cart-store'
import { useWishlistStore } from '@/lib/stores/wishlist-store'
import { useCompareStore } from '@/lib/stores/compare-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { ThemeToggle } from './theme-toggle'
import { AuthDialog } from './auth-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  imageUrl?: string
}

export function Header() {
  const setView = useUIStore((s) => s.setView)
  const view = useUIStore((s) => s.view)
  const openCart = useUIStore((s) => s.openCart)
  const mobileSearchOpen = useUIStore((s) => s.mobileSearchOpen)
  const setMobileSearchOpen = useUIStore((s) => s.setMobileSearchOpen)

  const cartCount = useCartStore((s) => s.count())
  const wishlistCount = useWishlistStore((s) => s.productIds.length)
  const compareCount = useCompareStore((s) => s.productIds.length)
  const user = useAuthStore((s) => s.user)
  const mounted = useMounted()
  const settings = useSettingsStore()
  const announcementText = settings.get('announcement_text')
  const brandName = settings.get('brand_name')
  const brandTagline = settings.get('brand_tagline')
  const brandLogoUrl = settings.get('brand_logo_url')
  const showTracking = settings.get('announcement_show_tracking') === 'true'
  const showBlog = settings.get('announcement_show_blog') === 'true'

  const [searchValue, setSearchValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories'),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchValue.trim()) return
    setView('shop', { q: searchValue.trim() })
    setMobileSearchOpen(false)
  }

  const go = (v: ViewName, params?: Record<string, string>) => {
    setView(v, params)
    setMobileMenuOpen(false)
  }

  // shortcut: press "/" to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        document.getElementById('avh-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Announcement bar — text & links are admin-configurable */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-1.5 text-[11px] sm:text-xs">
          <p className="flex items-center gap-1.5 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{announcementText}</span>
          </p>
          <div className="hidden items-center gap-3 sm:flex">
            {showTracking && (
              <button onClick={() => go('order-tracking')} className="hover:underline">
                Theo dõi đơn
              </button>
            )}
            {showTracking && showBlog && <span className="opacity-50">·</span>}
            {showBlog && (
              <button onClick={() => go('blog')} className="hover:underline">
                Cẩm nang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4">
          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Mở menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="px-4 py-4 border-b">
                <SheetTitle className="text-left">Danh mục</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-0.5 p-2">
                <button
                  onClick={() => go('home')}
                  className="flex items-center justify-between rounded px-3 py-2.5 text-sm hover:bg-accent"
                >
                  Trang chủ
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                {categories?.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => go('shop', { cat: c.slug })}
                    className="flex items-center justify-between rounded px-3 py-2.5 text-sm hover:bg-accent"
                  >
                    {c.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                <div className="my-2 border-t" />
                <button onClick={() => go('wishlist')} className="rounded px-3 py-2.5 text-sm hover:bg-accent text-left">
                  Sản phẩm yêu thích {mounted && wishlistCount > 0 ? `(${wishlistCount})` : ''}
                </button>
                <button onClick={() => go('compare')} className="rounded px-3 py-2.5 text-sm hover:bg-accent text-left">
                  So sánh sản phẩm {mounted && compareCount > 0 ? `(${compareCount})` : ''}
                </button>
                <button onClick={() => go('order-tracking')} className="rounded px-3 py-2.5 text-sm hover:bg-accent text-left">
                  Theo dõi đơn hàng
                </button>
                <button onClick={() => go('blog')} className="rounded px-3 py-2.5 text-sm hover:bg-accent text-left">
                  Cẩm nang nội thất
                </button>
                {user?.role === 'ADMIN' && (
                  <button onClick={() => go('admin')} className="rounded px-3 py-2.5 text-sm hover:bg-accent text-left flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Quản trị
                  </button>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <button
            onClick={() => go('home')}
            className="flex shrink-0 items-center gap-1.5"
            aria-label={`Trang chủ ${brandName}`}
          >
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-9 w-auto sm:h-10" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm sm:h-10 sm:w-10">
                AVH
              </div>
            )}
            <div className="hidden flex-col leading-none sm:flex">
              <span className="text-sm font-bold tracking-tight text-foreground">{brandName.toUpperCase()}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{brandTagline}</span>
            </div>
          </button>

          {/* Search (desktop) */}
          <form onSubmit={handleSearch} className="relative hidden flex-1 md:block max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="avh-search-input"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Tìm sofa, giường, đèn trang trí… (ấn / để focus)"
              className="h-10 pl-9 pr-4"
              aria-label="Tìm kiếm sản phẩm"
            />
            {searchFocused && searchValue && categories && (
              <div className="absolute left-0 right-0 top-12 z-50 rounded-lg border bg-popover p-2 shadow-lg">
                <p className="px-2 py-1 text-xs text-muted-foreground">Gợi ý tìm kiếm</p>
                <button
                  type="button"
                  onMouseDown={() => {
                    setSearchValue('')
                    setView('shop', { q: searchValue })
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Xem kết quả cho &ldquo;{searchValue}&rdquo;
                </button>
                <div className="my-1 border-t" />
                {categories.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => {
                      setSearchValue('')
                      setView('shop', { cat: c.slug })
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-2 text-sm hover:bg-accent"
                  >
                    {c.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              aria-label="Tìm kiếm"
            >
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            {user?.role === 'ADMIN' && (
              <Button
                variant="secondary"
                size="sm"
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => go('admin')}
                aria-label="Vào trang quản trị"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-xs font-semibold">Quản trị</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => (user ? go('account') : setAuthOpen(true))}
              aria-label="Tài khoản"
            >
              <User className="h-5 w-5" />
              {user && <span className="sr-only">{user.name}</span>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden sm:inline-flex"
              onClick={() => go('wishlist')}
              aria-label="Sản phẩm yêu thích"
            >
              <Heart className="h-5 w-5" />
              {mounted && wishlistCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {wishlistCount}
                </Badge>
              )}
            </Button>
            {mounted && compareCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="relative hidden sm:inline-flex"
                onClick={() => go('compare')}
                aria-label="So sánh"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
                </svg>
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {compareCount}
                </Badge>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={openCart}
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="h-5 w-5" />
              {mounted && cartCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile search bar */}
        {mobileSearchOpen && (
          <div className="border-t px-3 py-2 md:hidden">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Tìm sản phẩm…"
                className="h-9 pl-9 pr-9"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                aria-label="Đóng tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Category navigation lives inside the mobile hamburger menu (Sheet)
            above — no separate desktop bar. Keeps the header clean. */}
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  )
}

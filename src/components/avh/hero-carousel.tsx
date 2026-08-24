'use client'

import Image from 'next/image'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, ViewName } from '@/lib/stores/ui-store'

interface Banner {
  id: string
  title: string
  imageUrl: string
  mobileImageUrl?: string
  link?: string
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0)
  const setView = useUIStore((s) => s.setView)

  const next = useCallback(() => setIdx((i) => (i + 1) % banners.length), [banners.length])
  const prev = () => setIdx((i) => (i - 1 + banners.length) % banners.length)

  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(next, 6000)
    return () => clearInterval(id)
  }, [next, banners.length])

  if (!banners.length) return null

  const followLink = (link?: string) => {
    if (!link) {
      setView('shop')
      return
    }
    // parse "shop?cat=phong-ngu" or just a view name
    const [viewName, qs] = link.split('?')
    const params: Record<string, string> = {}
    if (qs) {
      new URLSearchParams(qs).forEach((v, k) => (params[k] = v))
    }
    setView((viewName as ViewName) || 'shop', params)
  }

  return (
    <section className="relative overflow-hidden rounded-xl bg-muted" aria-label="Khuyến mãi nổi bật">
      <div className="relative aspect-[16/9] sm:aspect-[2/1] md:aspect-[21/8] lg:aspect-[21/8]">
        {banners.map((b, i) => (
          <button
            key={b.id}
            onClick={() => followLink(b.link)}
            className={cn(
              'absolute inset-0 transition-opacity duration-700',
              i === idx ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
            aria-hidden={i !== idx}
            aria-label={b.title}
          >
            <Image
              src={b.imageUrl}
              alt={b.title}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
            {/* gradient overlay + title */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex items-end p-5 sm:p-8 md:p-10">
              <div className="max-w-lg text-left text-white">
                <h2 className="text-lg font-bold leading-tight drop-shadow sm:text-2xl md:text-3xl">{b.title}</h2>
                <p className="mt-1 hidden text-sm opacity-90 sm:block">Khám phá bộ sưu tập phù hợp với không gian của bạn</p>
                <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground sm:text-sm">
                  Mua ngay →
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 text-foreground shadow hover:bg-white md:block"
            aria-label="Trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 text-foreground shadow hover:bg-white md:block"
            aria-label="Sau"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Đến slide ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

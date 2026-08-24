'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Search, Eye, Calendar, ArrowRight, ChevronRight } from 'lucide-react'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  coverUrl: string
  tags: string[]
  views: number
  createdAt: string
  authorName: string
}

export function BlogView() {
  const setView = useUIStore((s) => s.setView)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const { data: posts, isLoading, error } = useQuery<BlogPost[]>({
    queryKey: ['blog'],
    queryFn: () => api.get('/api/blog'),
  })

  const tags = useMemo(() => {
    if (!posts) return []
    const set = new Set<string>()
    posts.forEach((p) => p.tags?.forEach((t) => set.add(t)))
    return Array.from(set).slice(0, 12)
  }, [posts])

  const filtered = useMemo(() => {
    if (!posts) return []
    const q = search.trim().toLowerCase()
    return posts.filter((p) => {
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q)
      const matchesTag = !activeTag || p.tags?.includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [posts, search, activeTag])

  const featured = filtered[0]
  const rest = filtered.slice(1)

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Header */}
      <header className="mb-6 border-b border-border/60 pb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => setView('home')} className="hover:text-primary">
            Trang chủ
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground/70">Cẩm nang</span>
        </div>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Newspaper className="h-7 w-7 text-primary" />
          Cẩm nang nội thất
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mẹo trang trí, xu hướng thiết kế, và hướng dẫn chọn đồ cho tổ ấm của bạn —
          viết bởi đội ngũ AVH Home.
        </p>
      </header>

      {/* Search + filter chips */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm bài viết…"
            className="pl-9"
            aria-label="Tìm bài viết"
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeTag === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground/80 hover:border-primary/50'
              }`}
            >
              Tất cả
            </button>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeTag === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground/80 hover:border-primary/50'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="aspect-[16/9] w-full rounded-2xl sm:aspect-[21/9]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Không tải được danh sách bài viết.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof ApiError ? error.message : 'Lỗi không xác định'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Newspaper className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Chưa có bài viết nào</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Thử bỏ bộ lọc hoặc từ khoá tìm kiếm khác.
          </p>
          {(search || activeTag) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch('')
                setActiveTag(null)
              }}
            >
              Xoá bộ lọc
            </Button>
          )}
        </div>
      )}

      {/* Featured post */}
      {!isLoading && !error && featured && (
        <article
          onClick={() => setView('blog-detail', { slug: featured.slug })}
          className="group mb-6 grid cursor-pointer overflow-hidden rounded-2xl border bg-card transition hover:shadow-lg lg:grid-cols-2"
        >
          <div className="relative aspect-[16/9] overflow-hidden bg-muted lg:aspect-[4/3]">
            <Image
              src={featured.coverUrl}
              alt={featured.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute left-3 top-3">
              <Badge className="bg-primary text-primary-foreground shadow">Nổi bật</Badge>
            </div>
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {featured.tags?.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
            <h2 className="line-clamp-3 text-xl font-bold leading-snug group-hover:text-primary sm:text-2xl">
              {featured.title}
            </h2>
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
              {featured.excerpt}
            </p>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{featured.authorName}</span>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(featured.createdAt).toLocaleDateString('vi-VN')}
              </span>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {featured.views.toLocaleString('vi-VN')}
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Đọc tiếp <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </article>
      )}

      {/* Grid of posts */}
      {!isLoading && !error && rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <article
              key={post.id}
              onClick={() => setView('blog-detail', { slug: post.slug })}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <Image
                  src={post.coverUrl}
                  alt={post.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {post.tags?.[0] && (
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur">
                    #{post.tags[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex flex-wrap gap-1">
                  {post.tags?.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">{post.authorName}</span>
                  <span aria-hidden>•</span>
                  <span>{new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
                  <span aria-hidden>•</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Eye className="h-3 w-3" />
                    {post.views.toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

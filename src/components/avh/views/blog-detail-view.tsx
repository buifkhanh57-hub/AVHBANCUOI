'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useUIStore } from '@/lib/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Facebook,
  Link as LinkIcon,
  ChevronRight,
  Newspaper,
  Mail,
} from 'lucide-react'

interface BlogPostDetail {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverUrl: string
  tags: string[]
  views: number
  createdAt: string
  authorName: string
}

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

/** Estimate Vietnamese reading time: ~200 wpm. */
function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * Lightweight markdown-ish renderer.
 * The backend stores `content` as paragraphs separated by \n\n with optional
 * `## Heading` lines and `- list` items. We don't pull a full markdown lib;
 * we render headings + paragraphs + simple bullets.
 */
function renderContent(content: string) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks.map((block, i) => {
    const lines = block.split(/\n/)
    // Whole-block heading
    if (lines.length === 1 && /^#{1,3}\s/.test(lines[0])) {
      const level = lines[0].match(/^(#{1,3})/)?.[1].length ?? 2
      const text = lines[0].replace(/^#{1,3}\s/, '')
      const Tag = (`h${Math.min(level + 1, 4)}` as 'h2' | 'h3' | 'h4')
      return (
        <Tag
          key={i}
          className="mt-7 mb-3 font-bold text-foreground first:mt-0"
        >
          {text}
        </Tag>
      )
    }
    // List block: every line starts with - or *
    if (lines.every((l) => /^[-*]\s/.test(l))) {
      return (
        <ul key={i} className="my-4 ml-5 list-disc space-y-1.5 text-sm sm:text-base">
          {lines.map((l, j) => (
            <li key={j} className="leading-relaxed">
              {l.replace(/^[-*]\s/, '')}
            </li>
          ))}
        </ul>
      )
    }
    // Single line with heading prefix inside a paragraph
    if (/^#{1,3}\s/.test(lines[0])) {
      const level = lines[0].match(/^(#{1,3})/)?.[1].length ?? 2
      const heading = lines[0].replace(/^#{1,3}\s/, '')
      const rest = lines.slice(1).join(' ')
      const Tag = (`h${Math.min(level + 1, 4)}` as 'h2' | 'h3' | 'h4')
      return (
        <div key={i}>
          <Tag className="mt-7 mb-3 font-bold text-foreground first:mt-0">{heading}</Tag>
          <p className="mb-4 text-sm leading-relaxed text-foreground/85 sm:text-base">{rest}</p>
        </div>
      )
    }
    // Paragraph — render with simple **bold** support
    return (
      <p key={i} className="mb-4 text-sm leading-relaxed text-foreground/85 sm:text-base">
        {renderInline(block)}
      </p>
    )
  })
}

/** Render inline **bold** segments. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{p}</span>
  })
}

export function BlogDetailView() {
  const params = useUIStore((s) => s.params)
  const setView = useUIStore((s) => s.setView)
  const slug = params.slug

  const { data: post, isLoading, error } = useQuery<BlogPostDetail>({
    queryKey: ['blog', slug],
    queryFn: () => api.get(`/api/blog/${slug}`),
    enabled: !!slug,
  })

  // Related posts — same listing endpoint, exclude current
  const { data: related } = useQuery<BlogPost[]>({
    queryKey: ['blog'],
    queryFn: () => api.get('/api/blog'),
  })
  const relatedPosts = useMemo(() => {
    if (!related || !post) return []
    return related.filter((p) => p.slug !== post.slug).slice(0, 3)
  }, [related, post])

  const handleShare = async (network: 'fb' | 'copy') => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (network === 'fb') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã sao chép liên kết')
    } catch {
      toast.error('Không sao chép được liên kết')
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-xl border border-dashed bg-card p-10">
          <Newspaper className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Không tìm thấy bài viết</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : 'Bài viết có thể đã bị xoá hoặc chuyển trang.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 gap-1"
            onClick={() => setView('blog')}
          >
            <ArrowLeft className="h-4 w-4" /> Về cẩm nang
          </Button>
        </div>
      </div>
    )
  }

  return (
    <article className="pb-12">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-3 pt-5 sm:px-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => setView('home')} className="hover:text-primary">
            Trang chủ
          </button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => setView('blog')} className="hover:text-primary">
            Cẩm nang
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 text-foreground/70">{post.title}</span>
        </div>
      </div>

      {/* Hero cover */}
      <div className="mx-auto mt-4 max-w-6xl px-3 sm:px-4">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted sm:aspect-[21/9]">
          <Image
            src={post.coverUrl}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-3 sm:px-4">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Article body */}
          <div className="min-w-0">
            {/* Header */}
            <header className="mb-6">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {post.tags?.map((t) => (
                  <button
                    key={t}
                    onClick={() => setView('blog')}
                    className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground hover:bg-accent/70"
                  >
                    #{t}
                  </button>
                ))}
              </div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
                {post.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {post.excerpt}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border/60 py-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {post.authorName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {readingTime(post.content)} phút đọc
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {post.views.toLocaleString('vi-VN')} lượt xem
                </span>
              </div>
            </header>

            {/* Content */}
            <div className="text-foreground/85">
              {renderContent(post.content)}
            </div>

            {/* Footer: share + back */}
            <div className="mt-10 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Chia sẻ:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleShare('fb')}
                >
                  <Facebook className="h-4 w-4" /> Facebook
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleShare('copy')}
                >
                  <LinkIcon className="h-4 w-4" /> Sao chép
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 self-start text-primary"
                onClick={() => setView('blog')}
              >
                <ArrowLeft className="h-4 w-4" /> Tất cả bài viết
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            {/* Related posts */}
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                <Newspaper className="h-4 w-4 text-primary" /> Bài viết liên quan
              </h3>
              {relatedPosts.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <ul className="space-y-3">
                  {relatedPosts.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => setView('blog-detail', { slug: r.slug })}
                        className="group flex w-full gap-2.5 text-left"
                      >
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={r.coverUrl}
                            alt={r.title}
                            fill
                            sizes="80px"
                            className="object-cover transition group-hover:scale-105"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium leading-snug group-hover:text-primary">
                            {r.title}
                          </p>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Newsletter signup card */}
            <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-accent/60 to-accent/40 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">Bản tin AVH</p>
                  <p className="text-[11px] text-muted-foreground">
                    Nhận mẹo trang trí mỗi tuần
                  </p>
                </div>
              </div>
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  toast.success('Đã đăng ký nhận tin')
                  ;(e.currentTarget.querySelector('input') as HTMLInputElement).value = ''
                }}
              >
                <Input type="email" required placeholder="email@cuaban.vn" aria-label="Email" />
                <Button type="submit" size="sm" className="w-full gap-1.5">
                  <Share2 className="h-4 w-4" /> Đăng ký
                </Button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </article>
  )
}

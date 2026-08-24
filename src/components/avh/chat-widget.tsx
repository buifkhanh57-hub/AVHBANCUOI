'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import Image from 'next/image'
import { Bot, Send, X, Sparkles, RefreshCw, Star, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUIStore } from '@/lib/stores/ui-store'
import { api, ApiError } from '@/lib/api'
import { formatVND } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ChatProductCard {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  image: string
  rating: number
  reviewCount: number
  category: string
}

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  ts: number
  products?: ChatProductCard[]
}

const SUGGESTIONS = [
  'Tư vấn sofa cho phòng khách 20m²',
  'Chất liệu nào dễ vệ sinh cho nhà có trẻ nhỏ?',
  'Chính sách bảo hành và đổi trả',
  'Đơn hàng của tôi khi nào giao?',
]

const WELCOME: ChatMsg = {
  role: 'assistant',
  content:
    'Chào anh/chị, em là **Trợ Lý AVH** — trợ lý mua sắm nội thất của Nội Thất AVH 🛋️\n\nEm có thể tư vấn sản phẩm phù hợp, giải đáp về chất liệu, kích thước, bảo hành, vận chuyển và tra cứu đơn hàng. Anh/chị cần hỗ trợ gì ạ?',
  ts: Date.now(),
}

export function ChatWidget() {
  const open = useUIStore((s) => s.chatOpen)
  const toggle = useUIStore((s) => s.toggleChat)
  const close = useUIStore((s) => s.closeChat)
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll on new message
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Persist guest token
  const [guestToken] = useState(() => {
    if (typeof window === 'undefined') return 'anon'
    let t = localStorage.getItem('avh-chat-guest')
    if (!t) {
      t = 'g_' + Math.random().toString(36).slice(2, 12)
      localStorage.setItem('avh-chat-guest', t)
    }
    return t
  })

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    if (trimmed.length > 1000) {
      toast.error('Tin nhắn quá dài (tối đa 1000 ký tự)')
      return
    }
    const userMsg: ChatMsg = { role: 'user', content: trimmed, ts: Date.now() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      // Build history from last 8 messages excluding the welcome
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))
      const data = await api.post<{ reply: string; products?: ChatProductCard[] }>('/api/chat', {
        message: trimmed,
        history,
        guestToken,
      })
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply,
          ts: Date.now(),
          products: data.products,
        } as ChatMsg,
      ])
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Có lỗi xảy ra, vui lòng thử lại sau.'
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ ${msg}`, ts: Date.now() },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const reset = () => {
    setMessages([WELCOME])
    toast.success('Đã bắt đầu phiên chat mới')
  }

  // Floating button
  if (!open) {
    return (
      <button
        onClick={toggle}
        aria-label="Mở chat với Trợ Lý AVH"
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:bg-primary/90 sm:bottom-6 sm:right-6"
      >
        <Bot className="h-7 w-7" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
          AI
        </span>
        <span className="avh-pulse absolute inset-0 rounded-full bg-primary/40 -z-10" />
      </button>
    )
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[88vh] flex-col rounded-2xl border bg-card shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] avh-pop">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
            <Bot className="h-5 w-5" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            Trợ Lý AVH <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </p>
          <p className="text-[11px] opacity-80">Trực tuyến · Trả lời trong vài giây</p>
        </div>
        <button onClick={reset} aria-label="Làm mới" className="rounded-full p-1.5 hover:bg-primary-foreground/10">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button onClick={close} aria-label="Đóng" className="rounded-full p-1.5 hover:bg-primary-foreground/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3"
        role="log"
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[80%] items-center gap-1 rounded-2xl rounded-bl-sm bg-card border px-3 py-2.5">
              <span className="avh-pulse text-xs">●</span>
              <span className="avh-pulse text-xs" style={{ animationDelay: '0.2s' }}>●</span>
              <span className="avh-pulse text-xs" style={{ animationDelay: '0.4s' }}>●</span>
              <span className="ml-1 text-[11px] text-muted-foreground">đang trả lời…</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-1.5 border-t bg-card px-3 py-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 border-t p-2.5"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi… (tối đa 1000 ký tự)"
          maxLength={1000}
          className="h-10"
          disabled={loading}
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="px-3 pb-2 text-center text-[10px] text-muted-foreground">
        Trợ Lý AVH là AI, có thể mắc sai sót. Vui lòng kiểm tra thông tin quan trọng.
      </p>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user'
  const setView = useUIStore.getState().setView
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border bg-card'
        )}
      >
        {msg.content.split('**').map((chunk, i) =>
          i % 2 === 1 ? <strong key={i} className="font-semibold">{chunk}</strong> : <span key={i}>{chunk}</span>
        )}
      </div>
      {/* Product cards — image + name + price + "Xem sản phẩm" button */}
      {msg.products && msg.products.length > 0 && (
        <div className="grid w-full max-w-[90%] grid-cols-2 gap-2">
          {msg.products.map((p) => (
            <button
              key={p.id}
              onClick={() => setView('product', { slug: p.slug })}
              className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="120px"
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-2">
                <p className="line-clamp-2 text-[11px] font-medium leading-tight">{p.name}</p>
                <p className="mt-0.5 text-sm font-bold text-primary">{formatVND(p.price)}</p>
                {p.comparePrice && p.comparePrice > p.price && (
                  <p className="text-[10px] text-muted-foreground line-through">{formatVND(p.comparePrice)}</p>
                )}
                <div className="mt-0.5 flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] text-muted-foreground">{p.rating?.toFixed(1)} ({p.reviewCount})</span>
                </div>
                <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                  Xem sản phẩm <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

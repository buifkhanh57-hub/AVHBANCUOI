'use client'

import { useEffect, useState } from 'react'

/** Countdown timer until target date. Shows DD HH MM SS boxes. */
export function CountdownTimer({
  target,
  variant = 'dark',
  size = 'md',
}: {
  target: Date | string
  variant?: 'dark' | 'light' | 'inline'
  size?: 'sm' | 'md' | 'lg'
}) {
  const t = typeof target === 'string' ? new Date(target) : target
  const [remaining, setRemaining] = useState(getRemaining(t))

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(t)), 1000)
    return () => clearInterval(id)
  }, [t.getTime()])

  const { d, h, m, s } = remaining
  const boxes = [
    { v: d, label: 'Ngày' },
    { v: h, label: 'Giờ' },
    { v: m, label: 'Phút' },
    { v: s, label: 'Giây' },
  ].filter((b) => b.label !== 'Ngày' || d > 0)

  if (variant === 'inline') {
    return (
      <span className="font-mono text-sm tabular-nums">
        {d > 0 && `${d}d `}
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    )
  }

  const sizeCls = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-sm'
  const bgCls = variant === 'dark' ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground'

  return (
    <div className="flex items-center gap-1">
      {boxes.map((b, i) => (
        <div key={b.label} className="flex items-center gap-1">
          <div className={`flex ${sizeCls} items-center justify-center rounded-md ${bgCls} font-mono font-bold tabular-nums`}>
            {pad(b.v)}
          </div>
          {i < boxes.length - 1 && <span className="text-sm font-bold">:</span>}
        </div>
      ))}
    </div>
  )
}

function getRemaining(t: Date) {
  const diff = Math.max(0, t.getTime() - Date.now())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

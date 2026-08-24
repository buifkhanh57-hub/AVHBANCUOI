'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({
  value,
  size = 14,
  className,
  showValue = false,
  count,
}: {
  value: number
  size?: number
  className?: string
  showValue?: boolean
  count?: number
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = value >= star
          const half = !filled && value >= star - 0.5
          return (
            <Star
              key={star}
              style={{ width: size, height: size }}
              className={cn(
                'transition',
                filled || half
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-muted text-muted-foreground'
              )}
              strokeWidth={1.5}
            />
          )
        })}
      </div>
      {showValue && (
        <span className="text-xs font-medium text-foreground">
          {value.toFixed(1)}
        </span>
      )}
      {typeof count === 'number' && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  )
}

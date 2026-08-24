'use client'

import { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { UploadCloud, X, Film, Loader2, LinkIcon, Plus, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface MediaItem {
  url: string
  type: 'image' | 'video'
  name?: string
  size?: number
}

interface Props {
  media: MediaItem[]
  onChange: (m: MediaItem[]) => void
  /** max number of items */
  max?: number
}

/**
 * Media uploader — drag/drop or click to pick multiple images AND videos,
 * uploads them to /api/upload, shows live previews with type badges and
 * remove buttons. Also accepts a pasted URL (image or video) as a fallback.
 *
 * Files are uploaded one-by-one so partial failures don't block the whole
 * batch, and each uploaded item is appended to the media array as soon as
 * its upload finishes.
 */
export function MediaUploader({ media, onChange, max = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (!list.length) return
      const remaining = max - media.length
      if (remaining <= 0) {
        toast.error(`Chỉ được tối đa ${max} file`)
        return
      }
      const toUpload = list.slice(0, remaining)
      if (list.length > remaining) {
        toast.warning(`Chỉ lấy ${remaining}/${list.length} file (giới hạn ${max})`)
      }

      setUploading(true)
      let okCount = 0
      const errors: string[] = []
      // Sequential uploads to avoid hammering the server.
      for (const file of toUpload) {
        try {
          const fd = new FormData()
          fd.append('files', file)
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const body = await res.json().catch(() => null)
          if (!res.ok || !body?.success) {
            throw new Error(body?.error || `HTTP ${res.status}`)
          }
          const uploaded: MediaItem[] = body.data.uploaded
          // Append the freshly uploaded items to the parent state via the
          // ref (avoids stale-closure since the loop is async).
          onChange([
            ...useMediaRef.current,
            ...uploaded.map((u: MediaItem) => ({
              url: u.url,
              type: u.type,
              name: u.name,
              size: u.size,
            })),
          ])
          okCount += uploaded.length
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : 'lỗi'}`)
        }
      }
      setUploading(false)
      if (okCount) toast.success(`Đã tải lên ${okCount} file`)
      if (errors.length) toast.error(errors.join('; '))
    },
    [media, max, onChange]
  )

  // Keep a ref to the latest media so the async upload loop can append to it
  // without stale-closure bugs.
  const useMediaRef = useRef(media)
  useMediaRef.current = media

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  const handleAddUrl = () => {
    const u = urlInput.trim()
    if (!u) return
    // crude type detection from extension
    const ext = u.split('.').pop()?.toLowerCase() || ''
    const isVideo = ['mp4', 'webm', 'mov'].includes(ext) || u.includes('video')
    onChange([...media, { url: u, type: isVideo ? 'video' : 'image', name: 'URL' }])
    setUrlInput('')
    toast.success('Đã thêm media từ URL')
  }

  const remove = (idx: number) => {
    onChange(media.filter((_, i) => i !== idx))
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= media.length) return
    const arr = [...media]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    onChange(arr)
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Kéo thả file hoặc bấm để chọn ảnh/video"
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40'
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-medium">
            {uploading ? 'Đang tải lên…' : 'Kéo thả hoặc bấm để chọn ảnh/video'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Định dạng: JPG, PNG, WebP, GIF, MP4, WebM
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files)
            e.target.value = '' // allow re-selecting same file
          }}
        />
      </div>

      {/* URL paste fallback */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="hoặc dán URL ảnh/video…"
            className="h-9 pl-8"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleAddUrl} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Previews */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {media.map((m, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              {m.type === 'video' ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <Film className="h-6 w-6 text-primary/70" />
                  <span className="line-clamp-2 text-[10px] text-muted-foreground">
                    {m.name || 'Video'}
                  </span>
                  {m.url.startsWith('/uploads') && (
                    <video
                      src={m.url}
                      className="absolute inset-0 h-full w-full object-cover opacity-40"
                      muted
                      preload="metadata"
                    />
                  )}
                </div>
              ) : (
                m.url && (
                  <Image
                    src={m.url}
                    alt={m.name || `Media ${idx + 1}`}
                    fill
                    sizes="120px"
                    className="object-cover"
                    unoptimized={m.url.startsWith('/uploads')}
                  />
                )
              )}

              {/* Type badge */}
              <span
                className={cn(
                  'absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
                  m.type === 'video' ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'
                )}
              >
                {m.type === 'video' ? 'Video' : 'Ảnh'}
              </span>

              {/* Cover badge for first item */}
              {idx === 0 && (
                <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white">
                  Ảnh bìa
                </span>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(idx)
                }}
                className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Xoá"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Reorder buttons */}
              <div className="absolute bottom-1 left-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    move(idx, -1)
                  }}
                  disabled={idx === 0}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Lên trước"
                >
                  <GripVertical className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {media.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {media.length}/{max} file · {media.filter((m) => m.type === 'image').length} ảnh,{' '}
          {media.filter((m) => m.type === 'video').length} video · mục đầu tiên là ảnh bìa
        </p>
      )}
    </div>
  )
}

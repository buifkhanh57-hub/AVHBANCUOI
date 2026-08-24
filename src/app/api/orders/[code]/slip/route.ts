import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timelineEntry } from '@/lib/format'
import { uploadFile } from '@/lib/storage'

/**
 * POST /api/orders/[code]/slip — customer uploads transfer slip (BANK payment).
 *
 * Accepts multipart/form-data with field "file" (image). Saves via the
 * storage abstraction (src/lib/storage.ts) — Cloudinary in production,
 * local /public/uploads/slips/ in dev. Attaches the resulting URL to the
 * order and adds a SLIP_UPLOADED timeline entry. Order stays PENDING_VERIFY
 * until admin reviews via /api/orders/[code]/review.
 *
 * SECURITY:
 *   - Image-only (jpg/png/webp/gif).
 *   - Max 8MB.
 *   - No auth required (the customer uploading a slip may not be logged in
 *     — guest checkout is allowed). Order code is the access token.
 */

const MAX_SLIP_SIZE = 8 * 1024 * 1024 // 8MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const order = await db.order.findUnique({ where: { code: code.toUpperCase() } })
  if (!order) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy đơn hàng' }, { status: 404 })
  }
  if (order.paymentMethod !== 'BANK') {
    return NextResponse.json({ success: false, error: 'Đơn này không thanh toán bằng chuyển khoản' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Thiếu file ảnh biên lai' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ success: false, error: 'Chỉ chấp nhận ảnh biên lai (jpg/png/webp)' }, { status: 400 })
  }
  if (file.size > MAX_SLIP_SIZE) {
    return NextResponse.json({ success: false, error: 'Ảnh quá lớn (tối đa 8MB)' }, { status: 400 })
  }

  // Upload via storage abstraction — Cloudinary in production, local FS in dev.
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await uploadFile(buffer, {
    folder: 'slips',
    filename: file.name,
    mimetype: file.type,
  })

  // Attach to order + add timeline entry.
  const timeline = JSON.parse(order.timeline || '[]')
  timeline.push(timelineEntry('SLIP_UPLOADED', `Khách đã tải lên biên lai chuyển khoản`))
  await db.order.update({
    where: { id: order.id },
    data: {
      slipUrl: result.url,
      slipUploadedAt: new Date(),
      timeline: JSON.stringify(timeline),
    },
  })

  return NextResponse.json({
    success: true,
    data: { url: result.url, uploadedAt: new Date().toISOString() },
  })
}

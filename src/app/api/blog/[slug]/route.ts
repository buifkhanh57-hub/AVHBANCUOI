import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON } from '@/lib/format'

// GET /api/blog/[slug] — single post; increments views
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  })
  if (!post || !post.published) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 })
  }
  // bump views best-effort
  await db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } })
  return NextResponse.json({
    success: true,
    data: {
      ...post,
      tags: parseJSON<string[]>(post.tags, []),
      authorName: post.author?.name || 'AVH',
    },
  })
}

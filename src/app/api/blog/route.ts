import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJSON } from '@/lib/format'

// GET /api/blog — list published posts
export async function GET() {
  const posts = await db.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverUrl: true,
      tags: true,
      views: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  })
  const data = posts.map((p) => ({
    ...p,
    tags: parseJSON<string[]>(p.tags, []),
    authorName: p.author?.name || 'AVH',
  }))
  return NextResponse.json({ success: true, data })
}

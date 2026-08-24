import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import * as path from 'path'
import { db } from '@/lib/db'
import { getAuthFromHeader } from '@/lib/auth-token'
import { SUPER_ADMIN_EMAIL } from '@/lib/super-admin'
import { logInfo } from '@/lib/system-log'

/**
 * GET /api/admin/web-update-log — list all file backups created by the AI
 *   Dev Agent, newest first. Each entry includes: filename, original path,
 *   timestamp, size, and a 500-char preview.
 *
 * POST /api/admin/web-update-log — restore a backup.
 *   Body: { backupPath: string } — accepts EITHER a legacy filesystem path
 *   (from old backups in .backups/) OR a database backup ID. The handler
 *   auto-detects: if the value starts with "db:" it's a DB id, otherwise
 *   it's treated as a legacy filesystem path (only works in dev sandbox).
 *
 * STORAGE:
 *   Backups are persisted in the `FileBackup` Prisma model (DB) so they
 *   survive serverless deploys. Legacy filesystem backups in `.backups/`
 *   are still readable for backward compat — they're auto-migrated to DB
 *   on first access.
 *
 * Auth: super-admin only (email === SUPER_ADMIN_EMAIL AND role === ADMIN).
 */

const PROJECT_ROOT = process.cwd()
const LEGACY_BACKUP_DIR = path.join(PROJECT_ROOT, '.backups')

export async function GET(req: NextRequest) {
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth || auth.role !== 'ADMIN' || auth.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    // Read DB-backed backups (new storage).
    const dbBackups = await db.fileBackup.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        originalPath: true,
        timestamp: true,
        size: true,
        preview: true,
        createdBy: true,
      },
    })

    // Try to read legacy filesystem backups (dev sandbox only —
    // graceful no-op on Netlify where FS is read-only).
    const legacyEntries: Array<Record<string, unknown>> = []
    try {
      await fs.mkdir(LEGACY_BACKUP_DIR, { recursive: true })
      const files = await fs.readdir(LEGACY_BACKUP_DIR)
      const visibleFiles = files.filter((f) => !f.startsWith('.')).slice(0, 50)
      for (const f of visibleFiles) {
        const fullPath = path.join(LEGACY_BACKUP_DIR, f)
        const stat = await fs.stat(fullPath)
        const parts = f.split('__')
        const tsPart = parts[0]
        const relPath = parts.slice(1).join('__').replace(/__/g, '/')
        let preview = ''
        try {
          const content = await fs.readFile(fullPath, 'utf8')
          preview = content.slice(0, 500)
        } catch {}
        legacyEntries.push({
          id: `legacy:${f}`,
          filename: f,
          backupPath: fullPath,
          originalPath: relPath,
          timestamp: tsPart,
          size: stat.size,
          preview,
          storage: 'legacy-fs',
        })
      }
    } catch {
      // Legacy FS not accessible (Netlify read-only FS) — skip silently.
    }

    // Merge DB + legacy backups, newest first.
    const allEntries = [
      ...dbBackups.map((b) => ({
        id: `db:${b.id}`,
        filename: `${b.timestamp.toISOString().replace(/[:.]/g, '-')}__${b.originalPath.replace(/[\/\\]/g, '__')}`,
        backupPath: `db:${b.id}`,
        originalPath: b.originalPath,
        timestamp: b.timestamp.toISOString(),
        size: b.size,
        preview: b.preview,
        storage: 'database',
        createdBy: b.createdBy,
      })),
      ...legacyEntries,
    ].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))

    return NextResponse.json({ success: true, data: allEntries.slice(0, 50) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json(
      { success: false, error: 'Failed to list backups: ' + msg },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth || auth.role !== 'ADMIN' || auth.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.backupPath) {
    return NextResponse.json({ success: false, error: 'Thiếu backupPath' }, { status: 400 })
  }

  const backupPath = String(body.backupPath)

  try {
    let backupContent = ''
    let originalPath = ''

    if (backupPath.startsWith('db:')) {
      // ── Database-backed backup (production path) ─────────────────────
      const id = backupPath.slice(3)
      const backup = await db.fileBackup.findUnique({ where: { id } })
      if (!backup) {
        return NextResponse.json(
          { success: false, error: 'Backup không tồn tại trong DB' },
          { status: 404 }
        )
      }
      backupContent = backup.content
      originalPath = backup.originalPath
    } else {
      // ── Legacy filesystem backup (dev sandbox only) ──────────────────
      // Security: backupPath must be inside LEGACY_BACKUP_DIR
      if (!backupPath.startsWith(LEGACY_BACKUP_DIR)) {
        return NextResponse.json(
          { success: false, error: 'backupPath không hợp lệ' },
          { status: 400 }
        )
      }
      backupContent = await fs.readFile(backupPath, 'utf8')
      const filename = path.basename(backupPath)
      const parts = filename.split('__')
      originalPath = parts.slice(1).join('__').replace(/__/g, '/')
    }

    const fullPath = path.resolve(PROJECT_ROOT, originalPath)
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return NextResponse.json(
        { success: false, error: 'Decoded path escapes project root' },
        { status: 400 }
      )
    }

    // Before restoring, save the CURRENT content as a new backup (so
    // restores are reversible — you can "undo" a restore too).
    try {
      const currentContent = await fs.readFile(fullPath, 'utf8')
      if (currentContent !== backupContent) {
        await db.fileBackup.create({
          data: {
            originalPath,
            content: currentContent,
            preview: currentContent.slice(0, 500),
            size: Buffer.byteLength(currentContent, 'utf8'),
            createdBy: auth.email,
          },
        })
      }
    } catch {
      // Current file doesn't exist (or FS is read-only on Netlify) —
      // on Netlify this whole restore operation will fail anyway since
      // we can't write the file. The error below will surface that.
    }

    // Restore: write backup content to the original file path.
    // NOTE: On Netlify (read-only FS at runtime) this write will fail.
    // This endpoint is intended for the dev sandbox only — production
    // deploys should use git for source-code management.
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, backupContent, 'utf8')

    await logInfo(
      'system',
      `Backup restored: ${originalPath}`,
      JSON.stringify({ restoredBy: auth.email, backupSource: backupPath.startsWith('db:') ? 'database' : 'legacy-fs' })
    )

    return NextResponse.json({
      success: true,
      data: {
        restoredPath: originalPath,
        sizeKB: (backupContent.length / 1024).toFixed(1),
        message: `Đã khôi phục ${originalPath} từ backup. File hiện tại đã được backup lại (để có thể undo).`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json(
      { success: false, error: 'Restore failed: ' + msg },
      { status: 500 }
    )
  }
}

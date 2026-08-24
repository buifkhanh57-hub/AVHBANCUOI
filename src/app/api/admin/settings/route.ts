import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAllSettings, SETTING_DEFS, seedSettings } from '@/lib/settings'
import { adminGuard } from '@/lib/middleware/admin-guard'

/**
 * GET /api/admin/settings — return all settings (merged with defaults).
 * Public read so the header/footer can render without auth — config is not
 * secret. Writes go through POST which would be admin-guarded in production.
 */
export async function GET() {
  // Ensure defaults exist (idempotent) so the admin form shows all fields.
  await seedSettings()
  const values = await getAllSettings()
  return NextResponse.json({
    success: true,
    data: {
      values,
      defs: SETTING_DEFS,
    },
  })
}

/**
 * POST /api/admin/settings — bulk update settings.
 * Body: { values: { key: value, ... } }
 * Only keys defined in SETTING_DEFS are accepted (whitelist).
 *
 * BANK ACCOUNT LOCK:
 *   The key `payment_bank_accounts` is HARD-REJECTED — the system uses a
 *   single fixed, hardcoded bank account (see src/lib/fixed-bank-account.ts).
 *   Any attempt to update this key returns 403 with code `BANK_ACCOUNT_LOCKED`.
 *   This is enforced server-side, so even if someone bypasses the admin UI
 *   (e.g. calls the API directly with curl), the request is still rejected.
 */
export async function POST(req: NextRequest) {
  const auth = await adminGuard(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!body?.values || typeof body.values !== 'object') {
    return NextResponse.json({ success: false, error: 'Thiếu trường values' }, { status: 400 })
  }

  // ── BANK ACCOUNT LOCK ───────────────────────────────────────────────
  // Reject any attempt to modify the bank account — it's hardcoded and
  // cannot be changed via the API. This is the server-side enforcement
  // layer; the admin UI also hides the form, but the API is the real
  // gatekeeper.
  const LOCKED_KEYS = new Set(['payment_bank_accounts'])
  const attemptedLocked = Object.keys(body.values).filter((k) => LOCKED_KEYS.has(k))
  if (attemptedLocked.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tài khoản ngân hàng cố định, không thể thay đổi qua API. Vui lòng liên hệ kỹ thuật để cập nhật code.',
        code: 'BANK_ACCOUNT_LOCKED',
        rejectedKeys: attemptedLocked,
      },
      { status: 403 }
    )
  }

  const allowed = new Set(SETTING_DEFS.map((d) => d.key))
  let updated = 0
  for (const [key, value] of Object.entries(body.values)) {
    if (!allowed.has(key)) continue
    // Belt-and-suspenders: even if SETTING_DEFS ever changes, the locked keys
    // above are still rejected.
    if (LOCKED_KEYS.has(key)) continue
    const def = SETTING_DEFS.find((d) => d.key === key)!
    await db.setting.upsert({
      where: { key },
      create: { key, value: String(value ?? ''), label: def.label, group: def.group },
      update: { value: String(value ?? '') },
    })
    updated++
  }
  return NextResponse.json({ success: true, data: { updated } })
}

import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromHeader } from '@/lib/auth-token'
import { runAgent, SUPER_ADMIN_EMAIL } from '@/lib/ai-agent'
import { logInfo, logWarn } from '@/lib/system-log'

/**
 * POST /api/admin/ai-agent — chat with the AI Dev Agent.
 *
 * ACCESS CONTROL — 3 layers, all must pass:
 *   1. JWT Bearer token valid (signed with NEXTAUTH_SECRET, not expired)
 *   2. role === 'ADMIN'
 *   3. email === SUPER_ADMIN_EMAIL ('buikhanh57@gmail.com' — hardcoded in
 *      src/lib/ai-agent.ts)
 *
 * This is the most powerful endpoint in the app — it can write arbitrary
 * files to the project + run arbitrary shell commands. So the access
 * check is intentionally strict: even other admins can't use it, only
 * the super-admin email hardcoded in code.
 *
 * Body: { message: string, history: Array<{role, content}> }
 * Response: { success: true, data: { reply, actions } }
 *
 * The agent's reply is the LLM's text. `actions` is the list of file
 * writes / shell commands the agent auto-executed (with stdout/stderr),
 * so the admin can audit what changed.
 */
export async function POST(req: NextRequest) {
  // ── Layer 1+2: JWT valid + role=ADMIN ───────────────────────────────
  const auth = await getAuthFromHeader(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Chưa đăng nhập hoặc token hết hạn' },
      { status: 401 }
    )
  }
  if (auth.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Chỉ admin mới được dùng AI Dev Agent' },
      { status: 403 }
    )
  }

  // ── Layer 3: super-admin email ─────────────────────────────────────
  if (auth.email !== SUPER_ADMIN_EMAIL) {
    await logWarn('auth', `AI Agent access DENIED for ${auth.email} — not super-admin`, JSON.stringify({ requiredEmail: SUPER_ADMIN_EMAIL }))
    return NextResponse.json(
      {
        success: false,
        error: `AI Dev Agent chỉ dành cho tài khoản ${SUPER_ADMIN_EMAIL}. Tài khoản của bạn không có quyền.`,
      },
      { status: 403 }
    )
  }

  // ── Parse request ──────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (!body?.message) {
    return NextResponse.json({ success: false, error: 'Thiếu message' }, { status: 400 })
  }
  const history = Array.isArray(body.history) ? body.history : []
  const model = body.model || 'glm-5.2'
  const thinking = body.thinking !== false  // default true (thinking ON)

  // ── Run agent ───────────────────────────────────────────────────────
  try {
    const result = await runAgent(String(body.message), history, { model, thinking })
    await logInfo('system', `AI Dev Agent executed by ${auth.email}`, JSON.stringify({
      messageLen: String(body.message).length,
      actionCount: result.actions.length,
      actions: result.actions.map((a) => ({ kind: a.kind, target: a.target, ok: a.ok })),
    }))
    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('AI Agent error:', err)
    return NextResponse.json(
      { success: false, error: 'AI Agent error: ' + (err?.message || String(err)) },
      { status: 500 }
    )
  }
}

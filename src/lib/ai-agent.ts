// AI Dev Agent — a senior full-stack engineer agent that can:
//   - Read code files (return content so the LLM can reason about them)
//   - Write code files (auto-apply edits the LLM suggests)
//   - Run shell commands (lint, db:push, restart, etc.)
//   - Query the DB (read-only, via Prisma)
//
// ACCESS CONTROL: only the super-admin email hardcoded below can use this
// agent. The route handler checks `user.email === SUPER_ADMIN_EMAIL` AND
// `user.role === 'ADMIN'`. This is intentionally NOT a Setting — to
// change the super-admin email, you'd have to deploy new code.
//
// PATTERN (ReAct-style, no native function-calling):
//   1. Send user message + system prompt + conversation history to LLM.
//   2. LLM responds with text + fenced code blocks marked with magic
//      comments:
//        ```typescript
//        // FILE: src/lib/foo.ts
//        <new file content>
//        ```
//        ```bash
//        bun run lint
//        ```
//   3. We parse the response, execute each action (write file / run shell),
//      capture stdout/stderr.
//   4. Return { reply, actions: [{ kind, target, ok, output }] } to the
//      admin UI so they see exactly what the agent did.
//
// SAFETY:
//   - File writes are restricted to /home/z/my-project/ (project root).
//     Paths with `..` are rejected.
//   - Shell commands run with a 30s timeout. Output is truncated to 5KB
//     so a runaway command doesn't blow up the response payload.
//   - DB queries are read-only (Prisma `queryRaw` only — no executeRaw).
//
// This is the "fix the web anytime, even after public launch" feature
// the merchant requested. It's dangerous by design (any file write +
// shell exec) — that's why it's locked to ONE hardcoded email.

import ZAI from 'z-ai-web-dev-sdk'
import { chatCompletion, detectBackend } from '@/lib/ai-client'
import { exec } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { db } from '@/lib/db'
import { SUPER_ADMIN_EMAIL } from '@/lib/super-admin'

// Re-export so the API route can import both from one place if needed.
export { SUPER_ADMIN_EMAIL }

// Available Z.ai models — the super-admin picks from this list in the UI.
export const AI_MODELS = [
  { id: 'glm-5.2', label: 'GLM 5.2 (mới nhất, tư duy sâu nhất)', recommended: true },
  { id: 'glm-5', label: 'GLM 5 (ổn định)', recommended: false },
  { id: 'glm-4-flash', label: 'GLM 4 Flash (nhanh, nhẹ)', recommended: false },
  { id: 'glm-4', label: 'GLM 4 (cũ)', recommended: false },
] as const

// Project root — all file operations are restricted to under this dir.
// Prevents the agent from writing to /etc, /home/other-user, etc.
const PROJECT_ROOT = '/home/z/my-project'

const SYSTEM_PROMPT = `You are AVH Dev Agent v3 — the personal AI of Bùi Khánh, powered by GLM 5.2 with thinking mode.

IDENTITY:
- "Tôi là AVH Dev Agent — trợ lý AI của Bùi Khánh, chạy trên GLM 5.2 với thinking mode."
- You are NOT a chatbot. You are a senior engineer who can read/write ANY file in the project and run ANY shell command.

AUTO-FILE-READING:
- You DON'T need the user to mention file paths. You PROACTIVELY search the codebase.
- When asked to fix/improve something, FIRST run \`find src -name "*.tsx" -o -name "*.ts" | head -50\` to see what files exist.
- Then read the relevant files yourself by suggesting \`cat <path>\` in a bash block.
- The backend auto-executes your bash commands and returns output.
- Use this to explore the codebase like a real engineer would.

WORKFLOW:
1. User asks for something (e.g. "redesign homepage premium")
2. You run: \`ls src/components/avh/views/home-view.tsx\` to find files
3. You run: \`cat src/components/avh/views/home-view.tsx\` to read current content
4. You write the new file with \`\`\`typescript // FILE: <path> <content> \`\`\`
5. You run: \`bun run lint\` to verify
6. The backend auto-applies all of this and returns results

RULES:
- ALWAYS respond in Vietnamese
- ALWAYS be concise — no fluff, just action
- After writing files, ALWAYS run \`bun run lint\`
- Don't rewrite files that don't need changes
- Don't touch: prisma/*, .env, src/app/api/payments/sepay/*, src/lib/ai-agent.ts, src/middleware.ts
- Don't touch: src/lib/payments/*, src/lib/auth-token.ts, src/lib/fixed-bank-account.ts
- You CAN touch: anything in src/components/*, src/app/page.tsx, src/app/globals.css, src/app/layout.tsx

PROJECT STACK:
- Next.js 16 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- Prisma SQLite + Zustand + TanStack Query
- SePay webhook (DO NOT TOUCH)
- Fixed bank: MB Bank / 0000000002 / BUI THI BAO LOAN
- Super-admin: buikhanh57@gmail.com`


interface AgentAction {
  kind: 'write_file' | 'run_shell' | 'read_file_result' | 'explanation'
  target?: string  // file path (for write_file) or command (for run_shell)
  ok: boolean
  output: string  // stdout/stderr for run_shell, success/error msg for write_file
  preview?: string  // first ~500 chars of file content (for read_file)
  backupPath?: string  // path to the backup of the old file content (for restore)
  timestamp?: string  // ISO timestamp of when the action ran
}

interface AgentResult {
  reply: string
  actions: AgentAction[]
}

export async function runAgent(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { model?: string; thinking?: boolean }
): Promise<AgentResult> {
  // Choose AI backend — Groq (preferred) or z.ai (sandbox fallback).
  // The agent uses the same backend as the customer-facing chat endpoint
  // so configuration is centralized in src/lib/ai-client.ts.
  const backend = detectBackend()
  // Default model:
  // - Groq: 'llama-3.3-70b-versatile' (fast + smart)
  // - z.ai: 'glm-5.2' (sandbox SDK default)
  // Operator can override via options.model or GROQ_MODEL env var.
  const model = options?.model || (backend === 'groq' ? (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') : 'glm-5.2')
  const thinking = options?.thinking ?? true

  // ── AUTO-READ FILES mentioned in the user's message ────────────────
  // If the user mentions a file path (e.g. "fix src/components/avh/product-card.tsx"),
  // we AUTOMATICALLY read that file's current content and include it in the
  // prompt. This way the AI knows the exact current code and can suggest a
  // precise edit — not a blind guess.
  const filePaths = extractFilePaths(userMessage)
  const fileContexts = await Promise.all(
    filePaths.map(async (fp) => {
      try {
        const fullPath = path.resolve(PROJECT_ROOT, fp)
        if (!fullPath.startsWith(PROJECT_ROOT)) return null
        const content = await fs.readFile(fullPath, 'utf8')
        return `\n\n--- CURRENT CONTENT OF ${fp} ---\n${content}\n--- END OF ${fp} ---\n`
      } catch {
        return null  // file doesn't exist or can't read
      }
    })
  )
  const fileContext = fileContexts.filter(Boolean).join('') || ''

  const augmentedMessage = fileContext
    ? `${userMessage}\n\n[SYSTEM] Dưới đây là nội dung hiện tại của các file bạn cần sửa. Hãy dùng nội dung này để đề xuất chỉnh sửa chính xác:\n${fileContext}\n\n[SYSTEM] Khi bạn muốn sửa file, hãy output code block với format:\n\`\`\`typescript\n// FILE: <đường-dẫn-file>\n<nội-dung-mới-toàn-bộ>\n\`\`\`\nBackend sẽ tự động ghi file + backup bản cũ. Sau khi ghi file, hãy suggest chạy \`bun run lint\` để kiểm tra.`
    : userMessage

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6),
    { role: 'user', content: augmentedMessage },
  ]

  // Use the configured AI backend (Groq preferred, z.ai fallback).
  // The thinking flag is only honored by the z.ai SDK; Groq ignores it.
  let reply = ''
  try {
    if (backend === 'groq') {
      const result = await chatCompletion(messages as any, {
        model,
        temperature: thinking ? 0.7 : 1,
        maxTokens: 4096,
      })
      reply = result.reply
    } else {
      // z.ai SDK — supports `thinking` parameter
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        model,
        messages: messages as any,
        thinking: { type: thinking ? 'enabled' : 'disabled' },
      })
      reply = completion.choices[0]?.message?.content || '(no response)'
    }
  } catch (err) {
    reply = `(AI error: ${err instanceof Error ? err.message : 'unknown'})`
  }

  if (!reply) reply = '(no response)'
  const actions = await parseAndExecuteActions(reply)

  return { reply, actions }
}

// ── Extract file paths from user message ─────────────────────────────
// Matches patterns like "src/lib/foo.ts", "src/components/avh/header.tsx",
// "prisma/schema.prisma", ".env", etc. — any path that looks like a project
// file path. This lets the agent auto-read files the user mentions.
function extractFilePaths(message: string): string[] {
  const paths: string[] = []
  // Match paths starting with src/, prisma/, public/, lib/, app/, components/, etc.
  // Also match relative paths like ".env", "package.json"
  const regex = /(?:^|\s|["'`(])((?:src|prisma|public|lib|app|components|hooks|skills|miniservices|mini-services)\/[^\s"'`),)]+)|(?:^|\s|["'`(])((?:\.env|package\.json|next\.config\.\w+|tsconfig\.json|tailwind\.config\.\w+))/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(message)) !== null) {
    const p = (match[1] || match[2] || '').replace(/[:.,;]+$/, '')
    if (p && p.length > 5 && !paths.includes(p)) {
      paths.push(p)
    }
  }
  return paths.slice(0, 5)  // max 5 files per message (token budget)
}

/**
 * Parse the LLM response for fenced code blocks with magic comments:
 *   ```typescript
 *   // FILE: src/lib/foo.ts
 *   <content>
 *   ```
 *   ```bash
 *   bun run lint
 *   ```
 *
 * Execute each action (write file / run shell) and return the results.
 * Non-code-block text is just the reply — no action.
 */
async function parseAndExecuteActions(reply: string): Promise<AgentAction[]> {
  const actions: AgentAction[] = []
  // Regex: ```lang\n...code...\n``` — capture lang + content
  const blockRegex = /```(\w+)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(reply)) !== null) {
    const lang = match[1].toLowerCase()
    const content = match[2]
    const now = new Date().toISOString()

    if (lang === 'typescript' || lang === 'tsx' || lang === 'ts' || lang === 'js' || lang === 'jsx' || lang === 'json' || lang === 'css' || lang === 'prisma') {
      // Check for // FILE: comment at the start → write file action
      const fileMatch = content.match(/^\/\/\s*FILE:\s*(.+)$/m) || content.match(/^#FILE:\s*(.+)$/m)
      if (fileMatch) {
        const filePath = fileMatch[1].trim()
        const fileContent = content.replace(fileMatch[0], '').replace(/^\n/, '')
        const result = await safeWriteFile(filePath, fileContent)
        actions.push({
          kind: 'write_file',
          target: filePath,
          ok: result.ok,
          output: result.message,
          preview: fileContent.slice(0, 200),
          backupPath: result.backupPath,
          timestamp: now,
        })
      }
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      // Run shell command (first non-empty line)
      const cmd = content.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || ''
      if (cmd) {
        const result = await safeRunShell(cmd)
        actions.push({
          kind: 'run_shell',
          target: cmd,
          ok: result.ok,
          output: result.output,
          timestamp: now,
        })
      }
    }
  }

  // If no actions were parsed, mark as explanation-only
  if (actions.length === 0) {
    actions.push({
      kind: 'explanation',
      ok: true,
      output: 'No file writes or shell commands in this response (explanation only).',
      timestamp: new Date().toISOString(),
    })
  }

  return actions
}

// ── Safe file write — backs up old content before writing ─────────────
// Before overwriting a file, we save the current content to
// /home/z/my-project/.backups/<timestamp>-<sanitized-path>. This way,
// if the AI's edit breaks something, the super-admin can restore the
// old version from the "Nhật ký cập nhật web" tab.
async function safeWriteFile(relPath: string, content: string): Promise<{ ok: boolean; message: string; backupPath?: string }> {
  // Reject path traversal — the agent must only touch files under PROJECT_ROOT
  if (relPath.includes('..')) {
    return { ok: false, message: `REJECTED: path "${relPath}" contains ".." (path traversal blocked)` }
  }
  const fullPath = path.resolve(PROJECT_ROOT, relPath)
  if (!fullPath.startsWith(PROJECT_ROOT)) {
    return { ok: false, message: `REJECTED: path "${relPath}" escapes project root` }
  }
  try {
    // ── BACKUP old content ───────────────────────────────────────────
    let backupPath: string | undefined
    try {
      const oldContent = await fs.readFile(fullPath, 'utf8')
      if (oldContent !== content) {
        // Only backup if content actually changed
        const backupDir = path.join(PROJECT_ROOT, '.backups')
        await fs.mkdir(backupDir, { recursive: true })
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        const sanitized = relPath.replace(/[\/\\]/g, '__')
        backupPath = path.join(backupDir, `${ts}__${sanitized}`)
        await fs.writeFile(backupPath, oldContent, 'utf8')
      }
    } catch {
      // File doesn't exist yet → no backup needed (first write)
    }

    // Ensure parent dir exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
    const sizeKB = (content.length / 1024).toFixed(1)
    return {
      ok: true,
      message: `Wrote ${relPath} (${sizeKB} KB)${backupPath ? ' — backup saved' : ' (new file, no backup)'}`,
      backupPath,
    }
  } catch (err: any) {
    return { ok: false, message: `Write failed: ${err?.message || String(err)}` }
  }
}

// ── Safe shell exec ────────────────────────────────────────────────────
async function safeRunShell(cmd: string): Promise<{ ok: boolean; output: string }> {
  // Reject obviously dangerous commands — defense in depth. The agent
  // shouldn't suggest these anyway, but if a prompt injection tries to
  // `rm -rf /` we block it.
  const dangerous = ['rm -rf /', 'rm -rf ~', 'mkfs', 'dd if=', '>: /etc/', 'shutdown', 'reboot']
  for (const d of dangerous) {
    if (cmd.includes(d)) {
      return { ok: false, output: `REJECTED: command "${cmd}" contains dangerous pattern "${d}"` }
    }
  }
  return new Promise((resolve) => {
    exec(cmd, { cwd: PROJECT_ROOT, timeout: 30_000, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = (stdout + (stderr ? '\n' + stderr : '')).slice(0, 5000)
      if (err) {
        resolve({ ok: false, output: `Exit code ${err.code || 'unknown'}: ${out}` })
      } else {
        resolve({ ok: true, output: out || '(no output)' })
      }
    })
  })
}

#!/usr/bin/env node
/**
 * scripts/setup-zai-config.js
 *
 * Generates the `.z-ai-config` JSON file at the project root from
 * environment variables. The z-ai-web-dev-sdk loads this file at runtime
 * to read its API key + base URL.
 *
 * WHY THIS EXISTS:
 *   - The SDK searches for `.z-ai-config` in CWD, then $HOME, then /etc/.
 *   - On Netlify (and any serverless host), we can't ship a committed
 *     .z-ai-config because it would contain the API key in plaintext
 *     in the git repo. And we can't write to /etc/ on Netlify.
 *   - Solution: run this script as part of the build command — it reads
 *     ZAI_API_KEY + ZAI_BASE_URL from Netlify env vars and writes
 *     `.z-ai-config` to the build directory. The file is then bundled
 *     into the serverless function.
 *
 * ENV VARS:
 *   ZAI_API_KEY   (required) — API key from z.ai dashboard
 *   ZAI_BASE_URL  (optional) — defaults to https://api.z.ai/api/paas/v4
 *
 * If ZAI_API_KEY is not set, the script logs a warning and exits 0
 * (don't fail the build — AI chat will just be disabled at runtime).
 */

const fs = require('fs')
const path = require('path')

const apiKey = process.env.ZAI_API_KEY
const baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4'
const chatId = process.env.ZAI_CHAT_ID || ''

const outPath = path.join(process.cwd(), '.z-ai-config')

if (!apiKey) {
  console.warn(
    '[setup-zai-config] WARNING: ZAI_API_KEY env var not set. ' +
      'AI chat (Trợ Lý AVH) will be disabled at runtime.'
  )
  process.exit(0)
}

const config = { apiKey, baseUrl }
if (chatId) config.chatId = chatId

try {
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2))
  console.log(`[setup-zai-config] ✓ wrote .z-ai-config (baseUrl=${baseUrl}, chatId=${chatId || 'none'})`)
} catch (err) {
  console.error('[setup-zai-config] failed to write .z-ai-config:', err.message)
  process.exit(1)
}

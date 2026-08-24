// AI client abstraction — supports BOTH z.ai SDK and OpenAI-compatible APIs
// (Groq, OpenAI, OpenRouter, Together, etc.)
//
// ENVIRONMENT VARIABLES (priority order):
//
// 1. If GROQ_API_KEY is set → use Groq (OpenAI-compatible, fast + cheap).
//    - GROQ_API_KEY:    "gsk_..." (get from https://console.groq.com)
//    - GROQ_BASE_URL:   "https://api.groq.com/openai/v1" (default)
//    - GROQ_MODEL:      "groq/compound" (default — supports web_search +
//                       code_interpreter + visit_website tools)
//
// 2. Else if ZAI_API_KEY is set + .z-ai-config file exists → use z.ai SDK
//    (the original AVH backend used by sandbox).
//
// 3. Else throw clear error so the chat endpoint fails with a helpful message
//    in the logs (chatbot feature disabled).
//
// This abstraction lets the operator switch backends without changing code —
// just set the right env vars + restart.

import OpenAI from 'openai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResult {
  reply: string
  // Optional metadata (model, tokens used) — useful for cost tracking.
  model?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

let openaiClient: OpenAI | null = null

/**
 * Detect which AI backend is configured.
 * Returns 'groq' | 'zai' | null.
 */
export function detectBackend(): 'groq' | 'zai' | null {
  if (process.env.GROQ_API_KEY) return 'groq'
  // z.ai SDK reads from .z-ai-config file. We can't check if the file exists
  // synchronously here — assume if ZAI_API_KEY is set, the SDK will work.
  if (process.env.ZAI_API_KEY) return 'zai'
  return null
}

/**
 * Get a cached OpenAI client configured for Groq.
 * Returns null if Groq is not configured (caller should fall back to z.ai).
 */
function getGroqClient(): OpenAI {
  if (openaiClient) return openaiClient
  openaiClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    // Default timeout — Groq is fast (200-500ms typical). Bump for the
    // chat-endpoint-with-product-cards flow that sends long system prompts.
    timeout: 30_000,
    maxRetries: 2,
  })
  return openaiClient
}

/**
 * Generate a chat completion using the configured backend (Groq preferred).
 * Throws if neither backend is configured.
 *
 * @param messages   Conversation history (system + user + assistant turns).
 * @param options    Optional: temperature, maxTokens, model override.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    model?: string
    // If true, returns a streaming async iterator of text chunks.
    stream?: boolean
  }
): Promise<ChatCompletionResult> {
  const backend = detectBackend()

  if (backend === 'groq') {
    return chatWithGroq(messages, options)
  }

  if (backend === 'zai') {
    return chatWithZai(messages, options)
  }

  throw new Error(
    'AI backend not configured. Set GROQ_API_KEY (preferred) or ZAI_API_KEY ' +
      'in environment variables. Get a Groq API key at https://console.groq.com.'
  )
}

/**
 * Groq backend — uses OpenAI SDK with Groq's OpenAI-compatible endpoint.
 */
async function chatWithGroq(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    model?: string
    stream?: boolean
  }
): Promise<ChatCompletionResult> {
  const client = getGroqClient()
  // Default model — `llama-3.3-70b-versatile` is FAST + smart.
  // Groq compound models (groq/compound, compound-mini) support tools but
  // are slower. For the chatbot UX (need fast responses), use llama-3.3-70b
  // by default unless operator explicitly overrides with GROQ_MODEL env var.
  const model = options?.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 1024,
    top_p: 1,
    // Don't request streaming at the SDK layer — we want the full reply
    // returned as a single string for the chat endpoint to parse.
    stream: false,
  } as Parameters<typeof client.chat.completions.create>[0])

  // Handle both ChatCompletion (non-streaming) and ChatCompletionChunk (streaming).
  const choice = (completion as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]
  const reply = choice?.message?.content?.trim() || ''

  return {
    reply,
    model: (completion as { model?: string }).model || model,
    usage: (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
      ? {
          promptTokens: (completion as { usage: { prompt_tokens: number } }).usage.prompt_tokens,
          completionTokens: (completion as { usage: { completion_tokens: number } }).usage.completion_tokens,
          totalTokens: (completion as { usage: { total_tokens: number } }).usage.total_tokens,
        }
      : undefined,
  }
}

/**
 * z.ai backend — uses the original z-ai-web-dev-sdk.
 * This is the sandbox-only fallback (z.ai SDK reads from .z-ai-config file).
 */
async function chatWithZai(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    model?: string
  }
): Promise<ChatCompletionResult> {
  // Dynamic import — z-ai-web-dev-sdk is only needed if z.ai backend is used.
  // This keeps the Groq-only deployment bundle smaller.
  const ZAIModule = await import('z-ai-web-dev-sdk')
  const ZAI = ZAIModule.default

  let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null
  if (!zaiInstance) zaiInstance = await ZAI.create()
  const zai = zaiInstance

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })

  const reply = completion.choices?.[0]?.message?.content?.trim() || ''
  return { reply }
}

// System logging — persists audit-trail entries to the DB so the admin
// can view them in the "Logs" tab. Covers product/order/payment/settings/auth events.

import { db } from '@/lib/db'

export type LogLevel = 'info' | 'warn' | 'error'
export type LogCategory = 'product' | 'order' | 'payment' | 'settings' | 'auth' | 'system'

export async function log(level: LogLevel, category: LogCategory, message: string, detail?: string) {
  try {
    await db.systemLog.create({
      data: { level, category, message, detail: detail || null },
    })
  } catch (err) {
    // logging should never crash the request — fall back to console
    console.error('[log] failed:', err)
  }
}

/** Convenience wrappers */
export const logInfo = (c: LogCategory, m: string, d?: string) => log('info', c, m, d)
export const logWarn = (c: LogCategory, m: string, d?: string) => log('warn', c, m, d)
export const logError = (c: LogCategory, m: string, d?: string) => log('error', c, m, d)

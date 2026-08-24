// Password hashing using Node's built-in crypto.scrypt (no external deps).
// scrypt is designed to be slow + memory-hard, resisting brute-force + GPU attacks.
// We store as: scrypt$N$r$p$saltHex$hashHex  (all params embedded so we can verify later).

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const N = 16384 // CPU/memory cost
const r = 8     // block size
const p = 1     // parallelization
const keyLen = 64

/** Hash a plaintext password → "scrypt$N$r$p$salt$hash" string for DB storage. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, keyLen, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Verify a plaintext password against the stored "scrypt$…" string. */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    // Backward compat: old demo stored plain-text passwords; accept a direct match
    // so existing users can still log in (they'll be upgraded on next password change).
    return password === stored
  }
  const [, n, r, pp, saltHex, hashHex] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const computed = scryptSync(password, salt, keyLen, {
    N: Number(n), r: Number(r), p: Number(pp), maxmem: 64 * 1024 * 1024,
  })
  // constant-time compare to prevent timing attacks
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

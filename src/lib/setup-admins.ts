// User management: delete the demo admin + create the 3 real admin accounts
// with hashed passwords. Run once via `bun run src/lib/setup-admins.ts` or
// hit POST /api/setup-admins.

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const NEW_ADMINS = [
  { email: 'buikhanh57@gmail.com', name: 'Bùi Khánh (Admin)' },
  { email: 'buithimai11021987@gmail.com', name: 'Bùi Thị Mai (Admin)' },
  { email: 'duongyenavh@gmail.com', name: 'Dương Yến (Admin)' },
  { email: 'nguyenanh2406@gmail.com', name: 'Nguyễn Anh (Admin)' },
]
const ADMIN_PASSWORD = 'avhstore@123'

export async function setupAdmins() {
  const result: string[] = []

  // 1) Delete the old demo admin (and any user with that email)
  const oldAdmin = await db.user.findUnique({ where: { email: 'admin@avh.vn' } })
  if (oldAdmin) {
    // cascade-related records are handled by onDelete; but orders keep a snapshot,
    // so the user can be safely removed.
    await db.user.delete({ where: { id: oldAdmin.id } })
    result.push(`✓ Đã xoá admin@avh.vn (id ${oldAdmin.id})`)
  } else {
    result.push('• admin@avh.vn không tồn tại (đã xoá trước đó)')
  }

  // 2) Create/upgrade the 3 new admins with hashed passwords
  for (const a of NEW_ADMINS) {
    const existing = await db.user.findUnique({ where: { email: a.email.toLowerCase() } })
    const hash = hashPassword(ADMIN_PASSWORD)
    if (existing) {
      // upgrade: set role ADMIN + hashed password
      await db.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', name: a.name, passwordHash: hash, authProviders: 'email' },
      })
      result.push(`✓ Đã cập nhật ${a.email} → ADMIN`)
    } else {
      await db.user.create({
        data: {
          email: a.email.toLowerCase(),
          name: a.name,
          role: 'ADMIN',
          passwordHash: hash,
          authProviders: 'email',
          memberTier: 'PLATINUM',
        },
      })
      result.push(`✓ Đã tạo admin ${a.email}`)
    }
  }

  // 3) Also delete the old demo customer (khach@avh.vn) — the user said they
  // want self-registration, so this demo account is no longer needed.
  const oldCustomer = await db.user.findUnique({ where: { email: 'khach@avh.vn' } })
  if (oldCustomer) {
    await db.user.delete({ where: { id: oldCustomer.id } })
    result.push(`✓ Đã xoá khách demo khach@avh.vn`)
  }

  return result
}

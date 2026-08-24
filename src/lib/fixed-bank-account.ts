// ============================================================================
// FIXED BANK ACCOUNT — the single, hardcoded, immutable bank account that
// ALL payments must use. No admin (not even super-admin) can change this.
// ============================================================================
//
// This is enforced server-side:
//   - POST /api/admin/settings rejects any request that touches the
//     `payment_bank_accounts` key (returns 403 BANK_ACCOUNT_LOCKED).
//   - POST /api/orders always snapshots this account into the PaymentSession,
//     so even if the Setting row is tampered with at the DB level, new orders
//     still use THIS account.
//   - /api/payments/sepay/webhook verifies `body.account_number` matches
//     this account; mismatches are rejected with 409 BANK_ACCOUNT_MISMATCH.
//
// Why a constant (not a Setting): the merchant specifically requested a
// single fixed account. Treating it as code (not data) means it cannot be
// changed from the admin panel — to change it, you'd have to deploy a new
// version of the code, which is an auditable, reviewable action.
//
// CURRENT CONFIG — SePay TEST MODE (MB Bank test account):
//   - accountNumber: 0000000002 (SePay test placeholder for MB Bank)
//   - holder:        BUI THI BAO LOAN (SePay test account holder)
//   - bank:          MB Bank (display name)
//   - bankCode:      mb (VietQR short code for MB Bank — used to generate
//                    QR images via img.vietqr.io)
//
// When SePay Test Mode sends a webhook for an MB Bank test transaction, the
// payload will have `accountNumber: "0000000002"` + `gateway: "MB Bank"`.
// Our `isFixedBankAccount()` matches by accountNumber only (gateway field
// from SePay is just a display label, not a stable code), so it will accept
// the test webhook.
//
// ⚠️ PRODUCTION: When moving to production, replace this constant with the
// real bank account info (the production account that SePay is linked to).
// Do NOT change .env (SEPAY_WEBHOOK_SECRET, SEPAY_API_TOKEN, NEXTAUTH_URL,
// webhook URL) — those stay the same in production. Only this constant
// changes.

export interface FixedBankAccount {
  /** Display name, e.g. "MB Bank" */
  bank: string
  /** VietQR short code, e.g. "mb" (lowercase, matches img.vietqr.io URL) */
  bankCode: string
  /** Account number, digits only */
  accountNumber: string
  /** Account holder, UPPERCASE per Vietnamese banking convention */
  holder: string
  /** Branch (optional, usually empty for personal accounts) */
  branch: string
}

export const FIXED_BANK_ACCOUNT: FixedBankAccount = {
  bank: 'MB Bank',
  bankCode: 'mb', // VietQR short code for MB Bank (NOT "MBABNK" — that's not a valid VietQR code)
  accountNumber: '0000000002', // SePay Test Mode account for MB Bank
  holder: 'BUI THI BAO LOAN', // SePay Test Mode account holder
  branch: '',
}

/**
 * Check whether a given account matches the fixed account.
 *
 * We ONLY compare accountNumber (digits-only, whitespace stripped) — the
 * bank code / gateway name in Sepay's payload can come in many forms
 * ("mb", "MB", "MB Bank", "MBBANK", "VPBank gateway", etc.) depending on
 * how Sepay labels the bank, so we can't reliably match on it. The account
 * number is the unique identifier for a bank account and is always sent as a
 * plain digits string by Sepay.
 */
export function isFixedBankAccount(account: {
  bankCode?: string
  accountNumber?: string
  gateway?: string
}): boolean {
  const received = (account.accountNumber || '').replace(/\s/g, '')
  return received !== '' && received === FIXED_BANK_ACCOUNT.accountNumber
}

/**
 * Human-readable summary for the admin panel. E.g.
 * "MB Bank · 0000000002 · BUI THI BAO LOAN"
 */
export const FIXED_BANK_ACCOUNT_DISPLAY = `${FIXED_BANK_ACCOUNT.bank} · ${FIXED_BANK_ACCOUNT.accountNumber} · ${FIXED_BANK_ACCOUNT.holder}`

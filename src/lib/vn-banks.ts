// Vietnamese bank list with VietQR short codes.
// Codes are fetched from the official VietQR API (api.vietqr.io/v2/banks)
// and match exactly what img.vietqr.io expects in the QR URL.
// Using wrong codes results in "invalid acqId" error → no QR generated.

export interface VNBank {
  code: string // VietQR short code (lowercase, matches URL)
  name: string // Display name
  bin: string // BIN (numeric bank ID)
}

export const VN_BANKS: VNBank[] = [
  { code: 'icb', name: 'VietinBank', bin: '970415' },
  { code: 'vcb', name: 'Vietcombank', bin: '970436' },
  { code: 'bidv', name: 'BIDV', bin: '970418' },
  { code: 'vba', name: 'Agribank', bin: '970405' },
  { code: 'mb', name: 'MB Bank', bin: '970422' },
  { code: 'tcb', name: 'Techcombank', bin: '970407' },
  { code: 'acb', name: 'ACB', bin: '970416' },
  { code: 'vpb', name: 'VPBank', bin: '970432' },
  { code: 'tpb', name: 'TPBank', bin: '970423' },
  { code: 'stb', name: 'Sacombank', bin: '970403' },
  { code: 'hdb', name: 'HDBank', bin: '970437' },
  { code: 'scb', name: 'SCB', bin: '970429' },
  { code: 'vib', name: 'VIB', bin: '970441' },
  { code: 'shb', name: 'SHB', bin: '970443' },
  { code: 'eib', name: 'Eximbank', bin: '970431' },
  { code: 'msb', name: 'MSB (Maritime Bank)', bin: '970426' },
  { code: 'vietbank', name: 'VietBank', bin: '970433' },
  { code: 'ocb', name: 'OCB', bin: '970448' },
  { code: 'bab', name: 'Bac A Bank', bin: '970409' },
  { code: 'ncb', name: 'NCB', bin: '970419' },
  { code: 'shbvn', name: 'Shinhan Bank', bin: '970424' },
  { code: 'abb', name: 'ABBANK', bin: '970425' },
  { code: 'vab', name: 'VietABank', bin: '970427' },
  { code: 'nab', name: 'NamABank', bin: '970428' },
  { code: 'pgb', name: 'PGBank', bin: '970430' },
  { code: 'bvb', name: 'BaoVietBank', bin: '970438' },
  { code: 'seab', name: 'SeABank', bin: '970440' },
  { code: 'coopbank', name: 'COOPBANK', bin: '970446' },
  { code: 'lpb', name: 'LPBank', bin: '970449' },
  { code: 'klb', name: 'KienLongBank', bin: '970452' },
  { code: 'gpb', name: 'GPBank', bin: '970408' },
  { code: 'cbb', name: 'CBBank', bin: '970444' },
  { code: 'vrb', name: 'VRB', bin: '970421' },
  { code: 'ivb', name: 'IndovinaBank', bin: '970434' },
  { code: 'pvcb', name: 'PVcomBank', bin: '970412' },
  { code: 'vccb', name: 'VietCapitalBank', bin: '970454' },
  { code: 'sgicb', name: 'SaigonBank', bin: '970400' },
  { code: 'hlbvn', name: 'HongLeong', bin: '970442' },
  { code: 'hsbc', name: 'HSBC', bin: '458761' },
  { code: 'citibank', name: 'Citibank', bin: '533948' },
  { code: 'scvn', name: 'StandardChartered', bin: '970410' },
  { code: 'pbvn', name: 'PublicBank', bin: '970439' },
  { code: 'uob', name: 'United Overseas', bin: '970458' },
  { code: 'wvn', name: 'Woori', bin: '970457' },
  { code: 'cimb', name: 'CIMB', bin: '422589' },
  { code: 'dbs', name: 'DBS Bank', bin: '796500' },
]

/** Build a VietQR image URL for a bank account + order info.
 *
 * Template options:
 *   - 'qr_only' (DEFAULT): just the QR code, no text/logo. Best for small
 *     display frames (160x160px) — the QR fills the entire image so the
 *     customer can scan it easily with any banking app.
 *   - 'compact': QR + bank logo + account info text. Looks nice on large
 *     displays but the QR is small inside the frame → hard to scan on mobile.
 *   - 'print': full printable receipt with all info. For paper invoices.
 */
export function buildVietQRUrl(opts: {
  bankCode: string
  accountNumber: string
  amount?: number
  addInfo?: string
  accountName?: string
  template?: 'compact' | 'qr_only' | 'print'
}): string {
  const { bankCode, accountNumber, amount, addInfo, accountName, template = 'qr_only' } = opts
  const base = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-${template}.png`
  const params = new URLSearchParams()
  if (amount != null && amount > 0) params.set('amount', String(amount))
  if (addInfo) params.set('addInfo', addInfo)
  if (accountName) params.set('accountName', accountName)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/** Find a bank by its code. */
export function findBankByCode(code: string): VNBank | undefined {
  return VN_BANKS.find((b) => b.code === code.toLowerCase())
}

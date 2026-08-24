// Generate payment QR codes for VNPay / MoMo / ZaloPay.
//
// We use api.qrserver.com (a public QR image generator) to render a QR from
// a payment deep-link string. When the customer scans the QR with the right
// app (MoMo app for MoMo QR, any banking app for VNPay QR, Zalo for ZaloPay),
// the app opens pre-filled with: merchant wallet, exact amount, and the
// order code as the transfer note.
//
// The merchant configures wallet numbers / bank accounts in
// Admin → Cài đặt → Thanh toán & Ngân hàng.

import { buildVietQRUrl } from './vn-banks'

interface QrOpts {
  amount: number
  orderCode: string
  // for VNPay: pick the first merchant bank account (VietQR)
  bankCode?: string
  accountNumber?: string
  holder?: string
  // for MoMo / ZaloPay: merchant wallet number
  walletNumber?: string
  walletHolder?: string
}

/** Build a QR image URL that encodes the given text payload. */
function qrImage(text: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`
}

/**
 * VNPay QR — in practice VNPay shows a bank-transfer QR (VietQR) with the
 * merchant's bank + amount + order code, so customers can scan with ANY
 * banking app. We re-use VietQR for this.
 */
export function vnpayQrUrl(o: QrOpts): string | null {
  if (!o.bankCode || !o.accountNumber) return null
  return buildVietQRUrl({
    bankCode: o.bankCode,
    accountNumber: o.accountNumber,
    amount: o.amount,
    addInfo: o.orderCode,
    accountName: o.holder,
  })
}

/**
 * MoMo QR — the merchant's MoMo wallet. Scanning with the MoMo app opens
 * a "send money" screen pre-filled with the wallet number, amount, and note.
 * Deep-link format: https://nhantien.momo.vn/{wallet}?amount={amt}&message={note}
 */
export function momoQrUrl(o: QrOpts): string | null {
  if (!o.walletNumber) return null
  const link = `https://nhantien.momo.vn/${o.walletNumber}?amount=${o.amount}&message=${encodeURIComponent(o.orderCode)}`
  return qrImage(link, 320)
}

/**
 * ZaloPay QR — encodes a ZaloPay payment intent. For demo, we encode a
 * payment string with the wallet + amount + note; scanning with Zalo opens
 * the payment confirmation.
 */
export function zaloPayQrUrl(o: QrOpts): string | null {
  if (!o.walletNumber) return null
  const payload = `zalopay://pay?wallet=${o.walletNumber}&amount=${o.amount}&message=${encodeURIComponent(o.orderCode)}`
  return qrImage(payload, 320)
}

/**
 * VietHell Pay QR — encodes a VietHell Pay deep-link. Scanning with the
 * VietHell Pay app opens a "send money" screen pre-filled with the wallet
 * number, exact amount, and the order code as the transfer note.
 *
 * Deep-link format mirrors the MoMo / ZaloPay convention so any mobile wallet
 * that understands `viethellpay://` URIs can pre-fill the payment.
 */
export function viethellQrUrl(o: QrOpts): string | null {
  if (!o.walletNumber) return null
  const link = `https://viethellpay.vn/pay/${o.walletNumber}?amount=${o.amount}&message=${encodeURIComponent(o.orderCode)}`
  return qrImage(link, 320)
}

/** Get the right QR builder for a given payment method. */
export function paymentQrFor(method: string, opts: QrOpts): string | null {
  switch (method) {
    case 'VNPAY':
      return vnpayQrUrl(opts)
    case 'MOMO':
      return momoQrUrl(opts)
    case 'ZALOPAY':
      return zaloPayQrUrl(opts)
    case 'VIETHELL':
      return viethellQrUrl(opts)
    case 'BANK':
      // BANK already handled by BankTransferInfo in checkout; reuse VietQR
      return opts.bankCode && opts.accountNumber
        ? buildVietQRUrl({ bankCode: opts.bankCode, accountNumber: opts.accountNumber, amount: opts.amount, addInfo: opts.orderCode, accountName: opts.holder })
        : null
    default:
      return null
  }
}

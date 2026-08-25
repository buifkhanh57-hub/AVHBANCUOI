'use client'

import { create } from 'zustand'

/**
 * Site settings store. Populated once on app mount via /api/admin/settings
 * (public read). Header/Footer/Home read from here so an admin change is
 * reflected instantly after the next settings fetch (or page reload).
 *
 * Default values mirror lib/settings.ts SETTING_DEFS so the site renders
 * correctly even before the first fetch completes.
 */
interface SettingsState {
  values: Record<string, string>
  loaded: boolean
  set: (values: Record<string, string>) => void
  get: (key: string, fallback?: string) => string
}

const DEFAULTS: Record<string, string> = {
  brand_name: 'Nội Thất AVH',
  brand_tagline: 'Nội thất & Trang trí nhà cửa',
  brand_logo_url: '',
  brand_description: 'Nội Thất AVH chuyên cung cấp nội thất và phụ kiện trang trí nhà cửa với thiết kế hiện đại, chất lượng đảm bảo và dịch vụ hậu mãi tận tâm.',
  contact_hotline: '1900 1234',
  contact_email: 'hello@noithat-avh.vn',
  contact_address: '123 Lê Lợi, Q.1, TP. Hồ Chí Minh',
  contact_working_hours: 'Thứ 2 - Chủ nhật: 8:00 - 20:00',
  social_facebook: 'https://facebook.com/noithat-avh',
  social_zalo: '0938123456',
  social_instagram: 'https://instagram.com/noithat-avh',
  social_youtube: 'https://youtube.com/@noithat-avh',
  social_tiktok: '',
  announcement_text: 'Hotline 1900 1234 · Miễn phí ship cho đơn từ 3 triệu',
  announcement_show_tracking: 'true',
  announcement_show_blog: 'true',
  shipping_free_threshold: '3000000',
  shipping_base_fee_city: '80000',
  shipping_base_fee_province: '120000',
  shipping_express_surcharge: '50000',
  shipping_installation_fee: '250000',
  min_order_amount: '1000',
  shipping_free_text: 'Giao toàn quốc',
  shipping_free_subtext: 'Free ship 3tr+',
  warranty_text: 'Bảo hành 24-36T',
  warranty_subtext: 'Chính hãng AVH',
  flash_text: 'Flash sale cuối tuần',
  flash_subtext: 'Giảm đến 35%',
  support_text: 'Hỗ trợ 24/7',
  support_subtext: 'Trợ Lý AVH',
  footer_about: 'Nội Thất AVH chuyên cung cấp nội thất và phụ kiện trang trí nhà cửa.',
  footer_copyright: 'Nội Thất AVH. Đã đăng ký bản quyền.',
  footer_payment_methods: 'Chuyển khoản ngân hàng,Visa,Mastercard,COD',
  // DEFAULT bank account — so checkout works out-of-the-box even before the
  // admin configures their own account. Vietcombank / 0123456789 / NỘI THẤT AVH
  // is a sensible placeholder that the admin can replace via Settings → Payment.
  // Once the admin saves a real account, this default is overwritten in DB
  // (and the settings-store pulls the latest from /api/admin/settings on mount).
  payment_bank_accounts: JSON.stringify([{
    bank: 'Vietcombank',
    bankCode: 'vcb',
    accountNumber: '0123456789',
    holder: 'NỘI THẤT AVH',
    branch: 'CN TP.HCM',
  }]),
  payment_momo_number: '',
  payment_momo_holder: '',
  payment_momo_qr: '',
  payment_zalopay_number: '',
  payment_zalopay_qr: '',
  payment_vnpay_merchant: '',
  payment_transfer_instructions: 'Quý khách vui lòng chuyển khoản đúng số tiền và ghi rõ mã đơn hàng ở phần nội dung. Sau khi chuyển, tải lên ảnh biên lai để chúng tôi xác nhận nhanh.',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  values: { ...DEFAULTS },
  loaded: false,
  set: (values) => set({ values: { ...DEFAULTS, ...values }, loaded: true }),
  get: (key, fallback) => {
    const v = get().values[key]
    if (v != null && v !== '') return v
    return fallback ?? DEFAULTS[key] ?? ''
  },
}))

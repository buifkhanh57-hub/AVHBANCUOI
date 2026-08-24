// Central definition of all editable site settings + default values.
// Used by: the seed (to persist defaults), the settings API (validation),
// the admin Settings tab (to render the form), and the public site (fallback
// when a setting hasn't been overridden).

import { db } from '@/lib/db'

export interface SettingDef {
  key: string
  label: string
  group: string
  type: 'text' | 'textarea' | 'url' | 'number' | 'image' | 'boolean'
  defaultValue: string
  placeholder?: string
  help?: string
}

// All configurable site-wide settings. Order within a group = display order.
export const SETTING_DEFS: SettingDef[] = [
  // --- Branding ---
  { key: 'brand_name', label: 'Tên thương hiệu', group: 'branding', type: 'text', defaultValue: 'Nội Thất AVH' },
  { key: 'brand_tagline', label: 'Khẩu hiệu (tagline)', group: 'branding', type: 'text', defaultValue: 'Nội thất & Trang trí nhà cửa' },
  { key: 'brand_logo_url', label: 'Logo (URL hoặc upload)', group: 'branding', type: 'image', defaultValue: '', help: 'Để trống nếu dùng chữ AVH mặc định' },
  { key: 'brand_description', label: 'Mô tả thương hiệu (footer)', group: 'branding', type: 'textarea', defaultValue: 'Nội Thất AVH chuyên cung cấp nội thất và phụ kiện trang trí nhà cửa với thiết kế hiện đại, chất lượng đảm bảo và dịch vụ hậu mãi tận tâm. Tầm nhìn: mỗi gia đình Việt đều có một tổ ấm đẹp, ấm áp và đúng gu.' },

  // --- Contact ---
  { key: 'contact_hotline', label: 'Hotline', group: 'contact', type: 'text', defaultValue: '1900 1234' },
  { key: 'contact_email', label: 'Email', group: 'contact', type: 'text', defaultValue: 'hello@noithat-avh.vn' },
  { key: 'contact_address', label: 'Địa chỉ cửa hàng', group: 'contact', type: 'text', defaultValue: '123 Lê Lợi, Q.1, TP. Hồ Chí Minh' },
  { key: 'contact_working_hours', label: 'Giờ làm việc', group: 'contact', type: 'text', defaultValue: 'Thứ 2 - Chủ nhật: 8:00 - 20:00' },

  // --- Social ---
  { key: 'social_facebook', label: 'Facebook URL', group: 'social', type: 'url', defaultValue: 'https://facebook.com/noithat-avh' },
  { key: 'social_zalo', label: 'Zalo (số hoặc link)', group: 'social', type: 'text', defaultValue: '0938123456' },
  { key: 'social_instagram', label: 'Instagram URL', group: 'social', type: 'url', defaultValue: 'https://instagram.com/noithat-avh' },
  { key: 'social_youtube', label: 'YouTube URL', group: 'social', type: 'url', defaultValue: 'https://youtube.com/@noithat-avh' },
  { key: 'social_tiktok', label: 'TikTok URL', group: 'social', type: 'url', defaultValue: '' },

  // --- Announcement bar (top of header) ---
  { key: 'announcement_text', label: 'Nội dung quảng cáo header', group: 'announcement', type: 'text', defaultValue: 'Hotline 1900 1234 · Miễn phí ship cho đơn từ 3 triệu', help: 'Dòng chữ chạy ở thanh trên cùng website' },
  { key: 'announcement_show_tracking', label: 'Hiện nút "Theo dõi đơn" ở header', group: 'announcement', type: 'boolean', defaultValue: 'true' },
  { key: 'announcement_show_blog', label: 'Hiện nút "Cẩm nang" ở header', group: 'announcement', type: 'boolean', defaultValue: 'true' },

  // --- Shipping policy (used in trust badges + checkout) ---
  { key: 'shipping_free_threshold', label: 'Ngưỡng miễn phí ship (₫)', group: 'shipping', type: 'number', defaultValue: '3000000', help: 'Đơn đạt giá trị này sẽ miễn phí ship (các thành phố lớn)' },
  { key: 'shipping_base_fee_city', label: 'Phí ship cơ bản (TP lớn HCM/HN)', group: 'shipping', type: 'number', defaultValue: '80000' },
  { key: 'shipping_base_fee_province', label: 'Phí ship cơ bản (Tỉnh khác)', group: 'shipping', type: 'number', defaultValue: '120000' },
  { key: 'shipping_express_surcharge', label: 'Phụ phí giao nhanh', group: 'shipping', type: 'number', defaultValue: '50000' },
  { key: 'shipping_installation_fee', label: 'Phí lắp đặt tận nơi', group: 'shipping', type: 'number', defaultValue: '250000' },
  { key: 'min_order_amount', label: 'Đơn tối thiểu (₫)', group: 'shipping', type: 'number', defaultValue: '1000', help: 'Đơn hàng phải đạt giá trị tối thiểu này mới được đặt' },
  { key: 'shipping_free_text', label: 'Text badge "Giao hàng toàn quốc"', group: 'shipping', type: 'text', defaultValue: 'Giao toàn quốc' },
  { key: 'shipping_free_subtext', label: 'Text phụ "Miễn phí ship"', group: 'shipping', type: 'text', defaultValue: 'Free ship 3tr+' },
  { key: 'warranty_text', label: 'Text badge "Bảo hành"', group: 'shipping', type: 'text', defaultValue: 'Bảo hành 24-36T' },
  { key: 'warranty_subtext', label: 'Text phụ "Bảo hành"', group: 'shipping', type: 'text', defaultValue: 'Chính hãng AVH' },
  { key: 'flash_text', label: 'Text badge "Flash sale"', group: 'shipping', type: 'text', defaultValue: 'Flash sale cuối tuần' },
  { key: 'flash_subtext', label: 'Text phụ "Flash sale"', group: 'shipping', type: 'text', defaultValue: 'Giảm đến 35%' },
  { key: 'support_text', label: 'Text badge "Hỗ trợ"', group: 'shipping', type: 'text', defaultValue: 'Hỗ trợ 24/7' },
  { key: 'support_subtext', label: 'Text phụ "Hỗ trợ"', group: 'shipping', type: 'text', defaultValue: 'Trợ Lý AVH' },

  // --- Footer ---
  { key: 'footer_about', label: 'Lời giới thiệu (footer)', group: 'footer', type: 'textarea', defaultValue: 'Nội Thất AVH chuyên cung cấp nội thất và phụ kiện trang trí nhà cửa với thiết kế hiện đại, chất lượng đảm bảo và dịch vụ hậu mãi tận tâm.' },
  { key: 'footer_copyright', label: 'Dòng bản quyền', group: 'footer', type: 'text', defaultValue: 'Nội Thất AVH. Đã đăng ký bản quyền.' },
  { key: 'footer_payment_methods', label: 'Phương thức thanh toán (cách nhau dấu phẩy)', group: 'footer', type: 'text', defaultValue: 'Chuyển khoản ngân hàng,Visa,Mastercard,COD' },

  // --- Payment: real bank accounts & e-wallets (admin-configurable) ---
  // SINGLE account per method (user requested: "chỉ dùng đúng 1 tài khoản thôi").
  // bank_accounts is a JSON array but we cap at 1 entry in the manager UI.
  // Each entry: { id, bank, bankCode, accountNumber, holder, branch?, qrUrl? }
  // qrUrl = admin-uploaded STATIC QR (QR #1). VietQR auto-generated = QR #2.
  { key: 'payment_bank_accounts', label: 'Tài khoản ngân hàng (JSON, tối đa 1)', group: 'payment', type: 'textarea', defaultValue: '[]', help: 'Dạng JSON: [{"bank":"Vietcombank","bankCode":"vcb","accountNumber":"0331001008999","holder":"CONG TY NOI THAT AVH","branch":"CN TP.HCM","qrUrl":"/uploads/..."}]. Chỉ dùng 1 tài khoản.' },
  { key: 'payment_vnpay_merchant', label: 'Mã merchant VNPay (TMN Code)', group: 'payment', type: 'text', defaultValue: '' },
  { key: 'payment_transfer_instructions', label: 'Hướng dẫn chuyển khoản', group: 'payment', type: 'textarea', defaultValue: 'Quý khách vui lòng chuyển khoản đúng số tiền và ghi rõ mã đơn hàng ở phần nội dung. Sau khi chuyển, nhấn nút "Tôi đã chuyển khoản" để hệ thống tự động xác nhận.' },
]

export const SETTING_GROUPS: { id: string; label: string; icon: string }[] = [
  { id: 'branding', label: 'Thương hiệu', icon: 'Store' },
  { id: 'contact', label: 'Liên hệ', icon: 'Phone' },
  { id: 'social', label: 'Mạng xã hội', icon: 'Share2' },
  { id: 'announcement', label: 'Quảng cáo header', icon: 'Megaphone' },
  { id: 'shipping', label: 'Chính sách giao hàng', icon: 'Truck' },
  { id: 'payment', label: 'Thanh toán & Ngân hàng', icon: 'Wallet' },
  { id: 'footer', label: 'Footer', icon: 'AlignLeft' },
]

/** Get a single setting value (string) with fallback to default. */
export async function getSetting(key: string): Promise<string> {
  const def = SETTING_DEFS.find((d) => d.key === key)
  const row = await db.setting.findUnique({ where: { key } })
  if (row?.value != null && row.value !== '') return row.value
  return def?.defaultValue ?? ''
}

/** Get all settings as a key->value object (defaults merged). */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const def of SETTING_DEFS) {
    const row = rows.find((r) => r.key === def.key)
    map[def.key] = row?.value != null && row.value !== '' ? row.value : def.defaultValue
  }
  return map
}

/** Seed default settings (idempotent — only inserts missing keys). */
export async function seedSettings() {
  for (const def of SETTING_DEFS) {
    const exists = await db.setting.findUnique({ where: { key: def.key } })
    if (!exists) {
      await db.setting.create({
        data: { key: def.key, value: def.defaultValue, label: def.label, group: def.group },
      })
    }
  }
}

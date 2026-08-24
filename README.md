# Nội Thất AVH — Cửa hàng nội thất online

Website bán nội thất toàn tập xây bằng **Next.js 16 + TypeScript + Prisma + Tailwind CSS + shadcn/ui**.

## ✨ Tính năng

### Phía khách hàng
- 🛋️ Trang chủ: banner carousel, danh mục, Flash Sale + countdown, sản phẩm nổi bật/mới/bán chạy
- 🛒 Cửa hàng: lọc theo danh mục, khoảng giá, tìm kiếm, sắp xếp, phân trang
- 📦 Chi tiết sản phẩm: thư viện ảnh + video, chọn biến thể (màu/size), thông số, đánh giá
- ❤️ Giỏ hàng / Yêu thích / So sánh (Zustand persisted)
- 💳 Thanh toán 4 bước (giao hàng → vận chuyển → thanh toán → xác nhận)
- 👤 Tài khoản: đơn hàng, địa chỉ, cài đặt (NextAuth.js)
- 📰 Blog + chi tiết bài viết
- 🤖 **Trợ Lý AVH** — chatbot AI tư vấn nội thất tiếng Việt (z-ai-web-dev-sdk LLM)

### Phía quản trị (Admin)
- Đăng nhập: `admin@avh.vn` / `admin123`
- Dashboard: KPI, biểu đồ doanh thu + danh mục (recharts)
- Quản lý sản phẩm: CRUD + **tải ảnh/video lên** (drag-drop)
- Quản lý đơn hàng: tìm theo mã, đổi trạng thái, xem cờ rủi ro
- Quản lý voucher, banner, Flash Sale
- **Cài đặt toàn bộ website**: logo, hotline, địa chỉ, MXH, thông báo header, chính sách giao hàng, **tài khoản ngân hàng + ví điện tử**
- **Phát hiện rủi ro/gian lận tự động** + duyệt ảnh biên lai chuyển khoản

### Tính năng nổi bật
- 🔐 **Tự sinh mã VietQR** — khách chọn "chuyển khoản" thì web tự tạo QR chứa đúng ngân hàng + số tài khoản + **số tiền chính xác** + mã đơn. Quét bằng app ngân hàng bất kỳ là trả được ngay.
- 🚨 **Tự động cờ rủi ro**: đơn giá trị cao (≥80tr) phải xác minh CCCD + biên lai; trùng SĐT 3 đơn/24h; COD giá trị cao + ẩn danh; mua số lượng lớn…
- 📤 Khách tải ảnh biên lai → nhân viên duyệt (xác nhận/từ chối) trong admin.

## 🚀 Chạy local

```bash
# 1. Cài đặt
bun install

# 2. Đẩy schema vào database
bun run db:push
bun run db:generate

# 3. Seed dữ liệu mẫu (tự động khi ghé thăm /api/seed lần đầu)
bun run dev
```

Mở http://localhost:3000 (server tự chạy ở cổng 3000).

## 🔑 Tài khoản demo

| Vai trò | Email | Mật mã |
|---|---|---|
| Quản trị | `admin@avh.vn` | `admin123` |
| Khách hàng | `khach@avh.vn` | `khach123` |

## 🛠️ Công nghệ

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM + SQLite
- **Auth**: NextAuth.js v4
- **State**: Zustand (client) + TanStack Query (server)
- **Charts**: Recharts
- **AI**: z-ai-web-dev-sdk (LLM, image generation, ASR, TTS, VLM, web search)
- **Icons**: Lucide React

## 📂 Cấu trúc

```
prisma/schema.prisma       # DB schema (User, Product, Order, ...)
src/app/                   # App Router pages + API routes
src/components/avh/        # Views + shared components
src/lib/                   # db client, api wrapper, settings, risk, vn-banks
src/stores/                # Zustand stores (auth, cart, wishlist, ui, settings)
public/                    # Static assets (banners, blog covers, product fixtures)
```

## 📝 Deploy production

Xem hướng dẫn deploy lên Vercel trong file [DEPLOY.md](./DEPLOY.md).

## 📄 License

Private project — Nội Thất AVH © 2025

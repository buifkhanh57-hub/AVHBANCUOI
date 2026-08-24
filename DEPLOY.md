# Hướng dẫn deploy production

## 1. Chuẩn bị

### Đổi DB sang PostgreSQL (bắt buộc cho Vercel)

SQLite không chạy được trên serverless. Đổi schema:

```prisma
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}
```

Lấy free PostgreSQL từ:
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (free 60MB)
- [Supabase](https://supabase.com) (free 500MB)
- [Neon](https://neon.tech) (free 0.5GB)

Sau khi có connection string:
```bash
bun run db:push   # tạo schema
bun run db:generate
```

### Lưu trữ ảnh upload

Serverless không ghi file cố định. Cấu hình S3/R2/Cloudinary:

1. Tạo bucket AWS S3 / Cloudflare R2 / Cloudinary
2. Cài `@aws-sdk/client-s3` hoặc dùng Cloudinary SDK
3. Sửa `src/app/api/upload/route.ts` để upload lên cloud thay vì `/public/uploads/`

## 2. Push lên GitHub

```bash
git init
git add .
git commit -m "init: Nội Thất AVH e-commerce"
git branch -M main
git remote add origin https://github.com/<bạn>/avh-furniture.git
git push -u origin main
```

## 3. Deploy lên Vercel

1. Vào [vercel.com](https://vercel.com) → New Project → import repo GitHub vừa push
2. Vercel tự nhận diện Next.js → bấm **Deploy**
3. 2-3 phút sau có URL: `https://avh-furniture.vercel.app`

### Cấu hình biến môi trường

Vào Vercel → Settings → Environment Variables:

| Tên | Giá trị |
|---|---|
| `DATABASE_URL` | `postgresql://...` (từ Vercel Postgres / Supabase) |
| `NEXTAUTH_SECRET` | chạy `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://avh-furniture.vercel.app` |
| `ZAI_API_KEY` | API key z-ai-web-dev-sdk |

### Thêm tên miền riêng

1. Mua tên miền ở [Mắt Báo](https://matbao.net) / [P.A Vietnam](https://pavietnam.vn) (~200-500k/năm)
2. Vercel → Settings → Domains → Add → nhập `noithatavh.vn`
3. Cập nhật DNS record theo hướng dẫn Vercel (thêm CNAME → `cname.vercel-dns.com`)
4. Đợi 5-30 phút để SSL tự cấp → web live ở `https://noithatavh.vn`

## 4. Lệnh deploy thủ công (tuỳ chọn)

```bash
# Cài Vercel CLI
bun add -g vercel

# Login + link project
vercel login
vercel link

# Deploy production
vercel --prod
```

## 5. Checklist trước khi go-live

- [ ] Đổi mật khẩu admin `admin123` → mật khẩu mạnh + đổi email
- [ ] Cấu hình email gửi thật (Resend / SendGrid) cho email xác nhận đơn
- [ ] Bật HTTPS-only cookies (`cookies.secure = true`)
- [ ] Test thanh toán thật (VNPAY/MoMo gateway nếu tích hợp)
- [ ] Backup DB định kỳ
- [ ] Setup monitoring (Vercel Analytics / Sentry)
- [ ] Xoá dữ liệu seed demo (chạy `db:reset` rồi seed lại chỉ production data)

## 6. Tuỳ chọn deploy khác

### VPS (Hostinger / VNCloud)

```bash
# Trên VPS
git clone https://github.com/<bạn>/avh-furniture.git
cd avh-furniture
bun install
bun run build
bun run start   # port 3000

# Caddy/Nginx reverse proxy + Let's Encrypt SSL
```

### Docker

Tạo `Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

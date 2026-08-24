# Worklog — Nội Thất AVH (Furniture E-commerce)

Project: Build a comprehensive furniture e-commerce platform "Nội Thất AVH" on Next.js 16 (single `/` route, SPA-style view navigation via Zustand).

---
Task ID: 0
Agent: main (orchestrator)
Task: Project bootstrap, schema design, foundation planning.

Work Log:
- Explored existing Next.js 16 scaffold; confirmed shadcn/ui components, Prisma (SQLite), Zustand, TanStack Query, Framer Motion, next-themes, z-ai-web-dev-sdk are installed.
- Loaded LLM and image-generation skill docs.
- Confirmed dev server running on port 3000.
- Designed Prisma schema covering: User, Address, Category, Product, ProductVariant, ProductMedia, Review, Question, Cart, CartItem, Order, OrderItem, Voucher, Wishlist, Notification, ChatSession, ChatMessage, Banner, FlashSale, BlogPost.
- SQLite constraint: no native lists -> store arrays (tags, materials, colors, specs keys) as JSON-encoded strings.

Stage Summary:
- Foundation plan ready. Building schema + seed + lib + API + UI next.

---
Task ID: 2-a
Agent: view-builder-A
Task: Build shop-view.tsx and product-view.tsx

Work Log:
- Read worklog + ui-store / cart / wishlist / compare / auth stores + api wrapper to understand established conventions; cross-checked products, categories, and reviews API routes for response shapes.
- Wrote `src/components/avh/views/shop-view.tsx`: breadcrumb + flash-sale banner with CountdownTimer, page header with result count and shadcn `Select` for sort (newest / price-asc / price-desc / best-selling / rating), sticky desktop sidebar + mobile `Sheet` housing a shared `FilterPanel` (search box, category quick-list with counts, price min/max inputs + presets, material & color checkboxes with color swatches, "Xóa bộ lọc" button), responsive product grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`), shadcn `Pagination` with prev/next + ellipsis-aware page list, empty state, error state, skeletons.
- Filter state initialised from `useUIStore` params (`cat`, `q`, `sort`, `flashSale`, `isNew`) and re-synced via `useEffect` when params change; local filter state (materials, colors, price range, page) drives TanStack Query URL building. Page resets to 1 on any filter change.
- Wrote `src/components/avh/views/product-view.tsx`: breadcrumb → 2-column layout (gallery + info) on desktop / stacked on mobile; image gallery with main image + thumbnail strip + badges (-% / Mới / Flash Sale / Nổi bật) + floating wishlist toggle; trust highlights (bảo hành / giao hàng / đổi trả).
- Info column: brand + title, star rating + review count + sold count + SKU, price block (current + compare-at strikethrough + discount badge, stock hint), variant selectors (color swatches, material chips, size chips) derived from variants; quantity stepper (min 1, max = variant stock); Add-to-cart (uses useCartStore + openCart) and Buy-now (adds line + setView('checkout')) buttons; wishlist / compare / Facebook-share / copy-link secondary actions; tag chips.
- Tabs (shadcn): "Mô tả" (whitespace-pre-line description), "Thông số" (specs grid), "Đánh giá" (rating distribution bar chart + avg + total + review list with avatar-first-letter fallback, verified badge, image grid, shop reply block, submit form gated by `useAuthStore.user` else login prompt → POST /api/reviews + invalidateQueries), "Hỏi đáp" (question list with answer block + ask-question form, no-op toast "Cảm ơn, chúng tôi sẽ phản hồi sớm").
- Related products grid at bottom using `ProductCard` (related items mapped to `ProductListItem` shape with `inStock: true` + current category).
- Sticky mobile bottom add-to-cart bar (lg:hidden) + spacer; dedicated `ProductSkeleton` and `NotFound` states; lucide icons only; warm primary/accent tokens from globals.css; no indigo/blue.
- Removed unused imports (`Image`, `formatVND`, `discountPct`, `Share2`, `CheckCircle2`); ran `tsc --noEmit` — both view files report zero TS errors.

Stage Summary:
- Files written:
  - `/home/z/my-project/src/components/avh/views/shop-view.tsx` (export `ShopView`)
  - `/home/z/my-project/src/components/avh/views/product-view.tsx` (export `ProductView`)
- Notable decisions: shop view keeps navigation-driven filters (cat/q/sort/flashSale/isNew) in store params and local-only filters (materials/colors/price/page) in component state; both flow into a single TanStack Query URL built with `URL`/`URLSearchParams` for clean encoding. Product view selects the most specific variant by color+material+size, falling back to color-only then first variant; uses raw `<img>` for review images (lucide+Avatar for avatars with first-letter fallback). Related items are normalised to `ProductListItem` with `inStock: true` so the existing `ProductCard` does not incorrectly render the "Hết hàng" overlay. Sticky mobile CTA bar added with spacer to avoid overlapping content.
- Next actions: integrate `ShopView` / `ProductView` into the root `page.tsx` view router (likely an `if (view === 'shop') return <ShopView/>` switch) — that wiring is out of scope for this sub-agent's task but both exports are ready to drop in.

---
Task ID: 2-c
Agent: view-builder-C
Task: Build wishlist-view.tsx, account-view.tsx, order-tracking-view.tsx, compare-view.tsx

Work Log:
- Read worklog + existing stubs (all 10-line "loading skeleton" placeholders), home-view for established patterns, plus stores (ui-store, wishlist-store, cart-store, compare-store, auth-store), format.ts (formatVND, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, MEMBER_TIERS, discountPct), api.ts (ApiError class), product-card.tsx (ProductListItem type, ProductCard), star-rating.tsx, and the relevant API routes (/api/products, /api/orders, /api/orders/[code], /api/products/[slug]) to confirm response shapes.
- Wrote src/components/avh/views/wishlist-view.tsx: fetches all products once via useQuery (`/api/products?limit=60`), filters client-side to wishlist IDs, renders ProductCard grid (grid-cols-2 sm:3 lg:4). Empty state with heart icon + "Khám phá sản phẩm" CTA. Header with count + "Xoá tất cả" (clears store) + "Tiếp tục mua sắm". Loading skeleton grid.
- Wrote src/components/avh/views/account-view.tsx: full dashboard with sidebar nav (desktop) / horizontal scrollable pill tabs (mobile). Six tabs: Tổng quan (avatar letter, name, tier badge with MEMBER_TIERS color, points, quick stats with orders/wishlist/points, recent orders preview), Đơn hàng của tôi (orders list fetched via /api/orders?userId, status badge colored per state, "Xem chi tiết" → setView('order-tracking', {code})), Sổ địa chỉ (sample/placeholder with toast on actions), Yêu thích (count + "Xem danh sách" → wishlist view), Thành viên & điểm (current tier, points, Progress bar to next tier, tier ladder SILVER→GOLD 3000pts→PLATINUM 10000pts, benefits list per tier), Thông báo (4 sample notifications with icons). Logout button in page header → logout() + setView('home'). Not-logged-in prompt triggers auth dialog via document.querySelector('[aria-label="Tài khoản"]').click().
- Wrote src/components/avh/views/order-tracking-view.tsx: reads params.code from useUIStore. If absent → search form ("Nhập mã đơn hàng" input + button, submits via setView('order-tracking', {code})). If code present → fetches /api/orders/[code]. Renders: header (code big mono, status badge, createdAt, total), installation/scheduledDate badges, 4-step horizontal TimelineStepper (Đã đặt → Đang xử lý → Đang giao → Đã giao, currentStep derived from status; CANCELLED/REFUNDED shows red X circle), vertical timeline detail list (from `timeline` array), shipping info card (name/phone/address/note), payment info card (method label, payment status badge, subtotal/shipping/discount/total breakdown), items list (image + name + qty + unit + line total). Buttons: "Mua lại" (re-adds all items to cart → setView('checkout')), "Liên hệ hỗ trợ" (useUIStore.getState().openChat()), "Về trang chủ". 404 → shows "Không tìm thấy đơn" + repeats search form with prefilled code. Loading skeleton.
- Wrote src/components/avh/views/compare-view.tsx: reads productIds from useCompareStore. Empty state with GitCompareArrows + "Đi mua sắm" CTA. Fetches products list once (`/api/products?limit=60`) to map id→slug, then useQueries for each product's full detail `/api/products/[slug]` to gather specs. Renders horizontally scrollable comparison table: header row = product image / name / category / price / StarRating / "Xem chi tiết" button / X-remove; body rows = FIXED_ROWS (price, comparePrice, discountPct, rating, soldCount, colors, materials, inStock) + dynamically-collected spec keys from all products' `specs` objects (union, label via SPEC_LABELS). Cells highlight with bg-primary/5 when values differ across columns. SpecValueCell auto-converts booleans (true/có/yes → green check; false/không/no → red X; "—" → grey minus). Loading skeleton row while details pending. Bottom: hint footer + "Tiếp tục so sánh" CTA.
- Removed unused imports (Separator/Truck/Clock in account-view; ChevronRight in order-tracking-view; allReady var in compare-view).
- Verified TypeScript + ESLint clean across all 4 files (npx tsc --noEmit shows zero errors for any of the four view paths; npx eslint on the four files passes with no output).

Stage Summary:
- Files written (all full implementations replacing the 10-line stubs):
  - src/components/avh/views/wishlist-view.tsx (≈115 lines)
  - src/components/avh/views/account-view.tsx (≈910 lines, includes 6 tab subcomponents + shared EmptyState/ErrorState helpers)
  - src/components/avh/views/order-tracking-view.tsx (≈640 lines, includes OrderSearchForm / OrderDetail / TimelineStepper / OrderSkeleton)
  - src/components/avh/views/compare-view.tsx (≈470 lines, includes ProductColumnHeader / SpecValueCell / SpecBooleanCell)
- All four views follow established conventions: 'use client', @/ aliases, Vietnamese UI text, shadcn components, sonner toast, lucide icons, terracotta/earth primary colors (no indigo/blue), warm tone status badges (amber/cyan/emerald/red/slate), responsive mobile-first, loading skeletons via <Skeleton>, TanStack Query (useQuery + useQueries for compare detail fan-out).
- Decisions worth noting:
  - Account auth: not-logged-in state clicks the header `[aria-label="Tài khoản"]` button (matches home-view pattern) rather than embedding its own dialog — keeps auth UI in one place.
  - Wishlist/Compare both fetch all 60 products once and filter client-side because there is no "by-ids" endpoint; query is shared with key ['products', 'all-60'] and 5min staleTime to avoid duplicate fetches.
  - Order tracking maps PENDING→step1 (Đã đặt), PROCESSING→step2, SHIPPING→step3, DELIVERED→step4; CANCELLED/REFUNDED short-circuits to a red X hero instead of the stepper.
  - "Mua lại" pushes all items to cart (slug left empty since order items don't store it; cart display still works) then jumps to checkout view.
  - Membership tier thresholds: SILVER 0 / GOLD 3000 / PLATINUM 10000 points (progress bar shows % toward next tier, fallback "highest tier reached" message for PLATINUM).
  - Compare view: spec rows are union of all products' specs keys (insertion-ordered, deduped); differences auto-highlighted with bg-primary/5; spec values auto-detect booleans for check/cross rendering.

---
Task ID: 2-b
Agent: view-builder-B
Task: Build cart-view.tsx, checkout-view.tsx, order-success-view.tsx

Work Log:
- Read worklog, stubs, ui-store, cart-store, auth-store, format.ts, api.ts, shipping.ts, product-card.tsx, cart-drawer.tsx, and API routes (/api/orders, /api/orders/[code], /api/vouchers, /api/products) to align on response shapes and conventions.
- Wrote `src/components/avh/views/cart-view.tsx` (`CartPageView`): full-width cart page with CartRow (image button → product, name, variant chips, qty selector with -/+/editable input, line total, remove). Voucher card with `api.get('/api/vouchers?code=...&subtotal=...')` via TanStack Query keyed by `[voucherCode, sub]`; uses a `useEffect` + `lastTriedCodeRef` to toast once on apply (success or error). Sticky summary sidebar with subtotal, discount, estimated shipping (free over 3M), total, "Tiến hành thanh toán" → setView('checkout'). Empty state with "Tiếp tục mua sắm". Suggested products grid (GET /api/products?limit=4&sort=best-selling) using ProductCard.
- Wrote `src/components/avh/views/checkout-view.tsx` (`CheckoutView`): 4-step stepper (Thông tin giao hàng → Vận chuyển & lắp đặt → Thanh toán → Xác nhận) with state-machine `step`. Step 1: name/phone/province-select(37 provinces)/district/ward/detail/note, prefilled from `user.name`; step 2: standard vs express radio + needsInstallation checkbox (+250k) + scheduled date + live shipping estimate via `shippingFeeFor()`; step 3: radio with COD/VNPay/MoMo/ZaloPay/Bank, icons, descriptions, and demo gateway note for non-COD; step 4: review address, shipping, payment, items. Validates step 1 (name, phone regex `^0\d{9}$`, all address fields) before allowing next. Sticky order-summary sidebar throughout with items + totals. POSTs to /api/orders with `{items, shippingName, shippingPhone, province, district, ward, detail, paymentMethod, voucherCode?, note?, needsInstallation?, scheduledDate?, userId?}`; on success clears cart and `setView('order-success', { orderCode: data.code })`, on error toasts `ApiError.message`. Empty-cart empty state with back-to-cart.
- Wrote `src/components/avh/views/order-success-view.tsx` (`OrderSuccessView`): reads `useUIStore.params.orderCode`; uses `useQuery` to GET `/api/orders/[code]` for full details. Hero with `CheckCircle2` + `animate-ping` halo, "Đặt hàng thành công!" heading, prominent order code chip. Summary card (totals, payment method, 3-5 day estimate, shipping address, items with qty badges), 4-stage timeline (PENDING/PROCESSING/SHIPPING/DELIVERED) with current ring highlight and PENDING badge, three CTAs (Theo dõi đơn hàng → setView('order-tracking', {code}), Tiếp tục mua sắm → setView('shop'), Về trang chủ → setView('home')), loyalty-program CTA card, and reassurance strip. Loading skeletons + error fallback. Separate `FallbackNotice` when no orderCode param.
- Verified all three files with `npx tsc --noEmit --skipLibCheck` (zero errors in these files) and `eslint` (clean). All icons, components, stores, and helpers are imported and used; no unused imports.
- Followed brand rules: warm terracotta `primary`/`accent`, Vietnamese UI throughout, mobile-first responsive grids, sonner toasts, Skeleton loaders, no indigo/blue primaries.

Stage Summary:
- Files written (3):
  - `/home/z/my-project/src/components/avh/views/cart-view.tsx` — `CartPageView`
  - `/home/z/my-project/src/components/avh/views/checkout-view.tsx` — `CheckoutView`
  - `/home/z/my-project/src/components/avh/views/order-success-view.tsx` — `OrderSuccessView`
- All three pass TypeScript + ESLint checks against the existing codebase.
- Integration points verified: `/api/vouchers`, `/api/orders` (POST + GET by code), `/api/products?sort=best-selling`, `useCartStore` (items, updateQty, removeItem, clear, subtotal, voucherCode, setVoucher, count), `useUIStore` (setView + params.orderCode), `useAuthStore` (user.id/name), `shippingFeeFor()`.

---
Task ID: 2-d
Agent: view-builder-D
Task: Build admin-view.tsx, blog-view.tsx, blog-detail-view.tsx

Work Log:
- Read worklog.md and inspected existing stubs (all 3 views were identical spinner placeholders). Surveyed lib/api.ts, lib/format.ts, lib/stores/ui-store.ts & auth-store.ts, src/app/api/{admin/stats,admin/products,blog,blog/[slug],orders/[code],vouchers,banners,products,categories}/route.ts for response shapes, plus shadcn UI export lists (dialog, alert-dialog, select, tabs, table, card, switch, checkbox, badge, skeleton) and brand chart colors in src/app/globals.css.
- Wrote src/components/avh/views/blog-view.tsx — header with breadcrumb, client-side search + tag-chip filter derived from posts, large featured-post hero card (lg:grid-cols-2), responsive card grid (sm:grid-cols-2 lg:grid-cols-3), loading skeletons, empty + error states, line-clamp excerpts, click → setView('blog-detail', { slug }).
- Wrote src/components/avh/views/blog-detail-view.tsx — hero cover (16:9 mobile / 21:9 desktop), tag chips, big title + excerpt, meta strip (author/date/reading-time/views), lightweight markdown-ish content renderer (splits on \n\n, converts `##` headings to h2/h3, renders `- list` blocks as <ul>, supports inline **bold**), 2-col desktop layout with sidebar containing "Bài viết liên quan" (3 related posts from /api/blog excluding current) and a newsletter signup card (toast "Đã đăng ký (demo)"), footer with Facebook share + copy-link + back button. 404 / loading states handled.
- Wrote src/components/avh/views/admin-view.tsx — access-control gate (`user?.role !== 'ADMIN'` → AccessDenied card with demo creds + button that calls document.querySelector('[aria-label="Tài khoản"]')?.click()), responsive sidebar (lg vertical, mobile horizontal scroll), 6 tabs: (1) Overview — 4 KPI cards + recharts LineChart (7-day revenueSeries, brand terracotta #c2654a + sage #7a8b5a) + BarChart (categoryBreakdown) + recent orders + low-stock/pending-orders alerts + top products list. (2) Products — Table (image, name+brand, category badge, price, featured/flash Switch toggles wired to PATCH /api/admin/products?id=ID, edit/delete actions), client-side search, Add/Edit Dialog with name/category select (from /api/categories)/brand/price/comparePrice/imageUrl/stock/featured/flash/new checkboxes → POST or PATCH + invalidateQueries(['products']), delete via AlertDialog confirmation (soft delete = unpublish). (3) Orders — search-by-code input that GETs /api/orders/[code]; default shows 5 recent orders from /api/admin/stats with "demo" note; each row expands to fetch detail by code and renders items + customer info + timeline + Select to PATCH /api/orders/[code] {status}. (4) Promotions — vouchers table from /api/vouchers (code, description, %/₫ badge, value, used count, active Switch visual-only) + "Tạo voucher" no-op toast + banners section from /api/banners with active toggle (visual). (5) Reviews — placeholder empty-state card. (6) Settings — store name / hotline / address form, no-op save with toast "Đã lưu (demo)".
- Refactored ProductFormDialog pre-fill from `useMemo` (anti-pattern) to `useEffect`; removed unused imports (TrendingDown, ChevronDown, Newspaper, Calendar, Eye, PieChart, Pie, Cell, PAYMENT_METHOD_LABELS).
- Ran `npx tsc --noEmit` and `npx eslint` on all three files — both pass clean. Dev server hot-reloads successfully (dev.log shows only the pre-existing /banners/*.png 404s from missing image fixtures, no errors traceable to the new views).

Stage Summary:
- src/components/avh/views/blog-view.tsx (281 lines) — Vietnamese UI, search + tag filter, featured hero + grid, empty/loading/error states. Verified compiling.
- src/components/avh/views/blog-detail-view.tsx (395 lines) — Hero, custom markdown-ish renderer (## headings, lists, **bold**), related-posts sidebar + newsletter card, share buttons, 404 state. Verified compiling.
- src/components/avh/views/admin-view.tsx (1669 lines) — Access control + 6-tab dashboard with KPIs, recharts (Bar+Line) in brand terracotta/sage palette, full product CRUD (Dialog+AlertDialog), order search/expand/status-patch, voucher+banner management, reviews placeholder, settings form. Verified compiling & lint clean.
- All three files overwrite the prior stubs; named exports AdminView / BlogView / BlogDetailView match the imports in src/app/page.tsx. Worklog appended.

---
Task ID: 3
Agent: main (orchestrator)
Task: Integration, lint fixes, image generation completion, final verification.

Work Log:
- Fixed zustand v5 import bug: persist/createJSONStorage must be imported from 'zustand/middleware', not 'zustand'.
- Created stub view files so page.tsx compiled during subagent work; subagents (2-a/2-b/2-c/2-d) replaced stubs with full implementations.
- Refactored page.tsx to use next/dynamic lazy imports for all 12 views — critical to bound dev-server memory (static imports caused OOM kills on the 4GB sandbox when compiling all views at once).
- Restarted dev server with `exec ./node_modules/.bin/next dev` (no `| tee` pipe) via setsid daemon to survive bash tool call cleanup.
- Disabled Prisma query logging to reduce memory/CPU overhead.
- Generated remaining hero banner (3) + blog cover (3) images with valid 1344x768 size (1440x720 rejected by API: not a multiple of 32).
- Fixed all ESLint errors:
  * shop-view.tsx: replaced two setState-in-effect blocks with React-recommended "adjust state during render" pattern (prevParamsKey + prevFilterKey).
  * product-view.tsx: moved product-id reset effect before setQty declaration (temporal dead zone); converted to during-render prevProductId + prevVariantId pattern; added setActiveMedia(0) to the reset block; removed 3 unused eslint-disable directives.
- Final `bun run lint`: 0 errors, 0 warnings.
- Agent Browser end-to-end verification:
  * Home page renders: hero carousel, category grid (6), flash sale with countdown, featured/new/best-sellers, blog teaser, newsletter CTA.
  * Shop view: breadcrumb, 14 products, filter sidebar (search, categories, price range), sort select, pagination.
  * Product detail: gallery, variant selectors, badges, rating, specs, tabs, related.
  * AI chat (Trợ Lý AVH): sent "Tư vấn sofa phòng khách 20m2 ngân sách 10 triệu" -> received relevant Vietnamese furniture recommendation via z-ai-web-dev-sdk backend proxy.
  * Add to cart + cart drawer: opens, shows item, totals.
  * Admin dashboard: KPI cards (14 products, 1 customer), recharts line/bar charts, recent orders, product table with CRUD dialogs, order status management, promotions.
  * Checkout: 4-step flow (shipping -> delivery -> payment -> review) renders.
  * Mobile responsive (390x844): mobile menu button present, layout stacks.
  * Dark/light mode toggle works.
  * Sticky footer present (mt-auto on flex-col min-h-screen wrapper).
- No console errors during navigation; only a benign LCP warning on product images.

Stage Summary:
- All 11 todos complete. App is fully runnable, lint-clean, and browser-verified.
- Dev server stable on port 3000 (~2.0GB used / 2.1GB free).
- Demo admin: admin@avh.vn / admin123. Demo customer: khach@avh.vn / khach123.
- 14 furniture products across 6 categories, 30 variants, 3 vouchers, 3 blog posts, 3 hero banners, 1 flash sale seeded.
- Trợ Lý AVH (LLM) works end-to-end via secure backend proxy (z-ai-web-dev-sdk) — API key never exposed to client.

---
Task ID: 4
Agent: main
Task: Make admin panel discoverable + add quick admin login.

Work Log:
- Root cause: admin link only existed in the mobile Sheet menu (visible only when logged in as admin) and the footer "Khu vực quản trị" link. Not discoverable on desktop.
- Added a visible "Quản trị" button (with LayoutDashboard icon) to the desktop header, shown only when user.role === 'ADMIN'.
- Upgraded AccessDenied screen in admin-view:
  * Added one-click "⚡ Đăng nhập nhanh (demo admin)" button that calls POST /api/auth/login with admin@avh.vn/admin123 directly (no need to open the auth dialog).
  * Kept "Đăng nhập bằng tài khoản khác" button that opens the auth dialog for other accounts.
  * Renamed title to "Trang quản trị Nội Thất AVH" + clearer description.
- Made footer "Khu vực quản trị" link more visible with a 🔒 icon.
- Agent Browser verified: footer/copy link → AccessDenied → click "Đăng nhập nhanh" → logged in as "Quản trị AVH" → admin dashboard renders (KPIs: 14 products / 1 customer, recharts line + bar, recent orders). Header shows "Quản trị" button after login.
- `bun run lint`: 0 errors, 0 warnings.

Stage Summary:
- Admin panel now reachable in 3 ways: (1) footer "🔒 Khu vực quản trị" link, (2) header "Quản trị" button when logged in as admin, (3) one-click quick login on the access-denied screen.
- Demo admin: admin@avh.vn / admin123 (or just click "Đăng nhập nhanh").

---
Task ID: 5
Agent: main
Task: Fix hydration error + add image/video upload feature for admin product form.

Work Log:
- Fixed hydration error in account-view.tsx (line 320): `<p>` containing `<Skeleton>` (which renders a `<div>`) → changed `<p>` to `<div>`. This was the only nested-div-in-p issue; other Skeletons were already inside `<div>` containers.
- Created POST /api/upload route:
  * Accepts multipart/form-data with field "files" (single or multiple).
  * Validates content-type prefix (image/* or video/*) + extension allowlist (jpg/jpeg/png/webp/gif/avif for images; mp4/webm/mov for videos).
  * Size limits: 8MB images, 25MB videos, max 10 files per request.
  * Generates random filenames (crypto.randomBytes) to prevent path traversal + collisions.
  * Saves to /public/uploads/products/<rand>.<ext>, returns array of {url, type, name, size}.
- Extended POST /api/admin/products to accept a `media` array of {url, type, thumbnail?} entries (supports images AND videos with ordering) in addition to the legacy single `imageUrl` string (backward-compat).
- Created MediaUploader component (src/components/avh/media-uploader.tsx):
  * Drag-and-drop zone + click-to-pick file input (accept="image/*,video/*", multiple).
  * Sequential upload to /api/upload with loading spinner; per-file error handling.
  * Live preview grid: image thumbnails + video icons, type badges (Ảnh/Video), first-item "Ảnh bìa" badge.
  * Per-item remove button, reorder hint.
  * URL paste fallback for adding media by link.
  * Uses a ref to avoid stale-closure bugs in the async upload loop.
- Updated ProductFormDialog in admin-view: replaced single "URL ảnh" text input with the MediaUploader; pre-fills media from existing product image on edit; sends `media` array + `imageUrl` (first item) on save.
- Verified end-to-end with Agent Browser:
  * curl POST /api/upload with sofa-grey.png → file saved (4585549f...png), response {success, uploaded:[{url,type,name,size}]}.
  * Admin → Products tab → "Thêm" → dialog shows "Ảnh & video sản phẩm" drop zone.
  * Upload via hidden file input → preview image appears, summary "1/10 file", second file saved (bea5d2a2...png).
- `bun run lint`: 0 errors, 0 warnings.
- Server stable on port 3000.

Stage Summary:
- Hydration error fixed (no more div-in-p warnings).
- Admin can now upload ảnh + video trực tiếp (drag-drop hoặc chọn file) thay vì dán URL. Files lưu vào /public/uploads/products/, hỗ trợ nhiều file cùng lúc, preview có badge phân biệt ảnh/video, nút xoá + đổi thứ tự.

---
Task ID: 6
Agent: main
Task: Make entire site admin-configurable (logo, social links, announcement, shipping policy, footer) + category CRUD + Flash Sale management tab.

Work Log:
- Added `Setting` model (key/value store) to Prisma schema + pushed.
- Created `src/lib/settings.ts`: defines 30+ configurable settings across 6 groups (branding, contact, social, announcement, shipping, footer) with default values + types (text/textarea/url/number/image/boolean).
- Created settings store (`useSettingsStore`) with baked-in defaults so the site renders correctly before the first fetch.
- Page.tsx now loads settings on mount and populates the store → Header/Footer read live values.
- API routes:
  * GET/POST /api/admin/settings — read all / bulk update (whitelisted keys).
  * POST/PATCH/DELETE /api/admin/categories — create/update/delete (blocks delete if products exist).
  * GET/POST/PATCH/DELETE /api/admin/flash-sale — full CRUD; toggling attaches/detaches products + sets isFlashSale flag.
- Header: announcement bar text + show/hide tracking & blog links + brand logo/name/tagline all read from settings store.
- Footer: brand block (logo/name/tagline), about text, contact (address/hotline/email/working hours), social links (FB/Zalo/Instagram/YouTube/TikTok — only show if configured), trust badges (text+subtext editable), payment methods list, copyright — all from settings.
- Rebuilt admin Settings tab: grouped sidebar nav (Thương hiệu / Liên hệ / Mạng xã hội / Quảng cáo header / Chính sách giao hàng / Footer), per-field rendering by type (text/textarea/url/number/boolean switch/image-with-upload), dirty-state tracking, "Lưu thay đổi" posts only changed keys, live-updates the settings store so header/footer reflect immediately.
- Added Flash Sale tab to admin sidebar: list all flash sales (name, date range, product count, status badge: Đang chạy/Sắp chạy/Đã kết thúc/Tạm dừng), create form (name + start/end datetime), toggle active switch, delete with confirmation.
- Verified via curl: settings round-trip (POST 4 values → read back correct), flash sale list shows "Flash Sale Cuối Tuần" with 4 products, category create returns new id+slug.
- `bun run lint`: 0 errors, 0 warnings.
- Server stable on port 3000 after restart (admin-view ~2050 lines compiles fine alone; chromium concurrent launch still causes transient OOM — UI verified via API round-trips + earlier browser sessions confirming the shared component patterns).

Stage Summary:
- Everything on the website is now admin-editable: logo, brand name/tagline, hotline, email, address, working hours, Facebook/Zalo/Instagram/YouTube/TikTok links, announcement bar text + link toggles, shipping policy badges text (Giao hàng/Bảo hành/Flash/Hỗ trợ), free-ship threshold, footer about + copyright + payment methods.
- New admin tabs: "Flash Sale" (CRUD flash sale events) + "Cài đặt" rebuilt with full site config.
- Category CRUD available via API (POST/PATCH/DELETE /api/admin/categories); product delete already existed.

---
Task ID: 7
Agent: main
Task: Fix hydration error + remove demo notes + add real bank/e-wallet config + automatic fraud/risk detection + transfer-slip upload + admin review flow.

Work Log:
- **Hydration fix**: created `src/hooks/use-mounted.ts` (`useMounted` returns false on server, true after mount). Gated cart/wishlist/compare Badge counts in Header behind `mounted` so server HTML and first client render agree (the persisted Zustand stores loaded from localStorage caused the mismatch). Same gate applied to mobile-menu count text.
- **Removed all "demo" notes** to make the site feel real:
  * auth-dialog: cleared prefilled admin@avh.vn/admin123 credentials, removed credential hint paragraph, replaced OTP "123456" demo hint with real instructions, changed Google/Apple button toasts, added "Đăng ký tại đây" link.
  * admin AccessDenied: removed quick-login button + credential block; replaced with "Về trang cửa hàng" + "Đăng nhập quản trị" buttons.
  * Removed "(demo)" text from admin orders tab, promotions, banner management, checkout payment note, blog-detail newsletter toast.
- **Real bank accounts & e-wallets** (admin-configurable):
  * New settings group "payment" with: payment_bank_accounts (JSON array), payment_momo_number/holder, payment_zalopay_number, payment_vnpay_merchant, payment_transfer_instructions.
  * Added to settings-store defaults + admin GROUP_ICONS/LABELS.
  * New `BankTransferInfo` component in checkout-view: when customer selects "Chuyển khoản (BANK)", shows the merchant's real bank accounts (bank name, account number, holder, branch, optional QR image), MoMo/ZaloPay wallets, the order-code transfer note hint, and total amount. Reads live from settings store so admin changes appear instantly.
- **Automatic fraud / risk detection** (`src/lib/risk.ts` + `computeRiskFlags()`):
  * VERY_HIGH_VALUE (≥80M₫): require ID verification + slip before shipping.
  * HIGH_VALUE (≥30M₫): info flag to call customer first.
  * DUPLICATE_PHONE: same phone ≥3 orders in 24h → warn (possible abuse).
  * BANK_HIGH_VALUE_NO_SLIP: bank transfer + high value → don't ship until slip confirmed.
  * BULK_ITEMS (≥10 items): verify not bulk-reseller.
  * ANON_COD_HIGH_VALUE: anonymous + COD + high value → COD-refusal risk.
  * SHORT_ADDRESS / SUSPICIOUS_NAME: info flags to verify before shipping.
  * Computed at order creation, stored as `riskFlags` JSON on the Order, surfaced in order response + admin.
- **Schema additions** to Order: `riskFlags String @default("[]")`, `slipUrl String?`, `slipUploadedAt DateTime?`, `reviewNote String?`. paymentStatus now includes `PENDING_VERIFY` for BANK orders awaiting slip.
- **Transfer-slip upload flow**:
  * POST /api/orders/[code]/slip — customer uploads slip image (validated: image only, ≤8MB, BANK payment only). Saves to /public/uploads/slips/, attaches to order, adds SLIP_UPLOADED timeline entry.
  * `SlipUploader` component in order-success-view: drop-zone + preview, only shows for BANK orders. Re-upload supported.
- **Admin review flow**:
  * POST /api/orders/[code]/review — staff confirms or rejects slip. Confirm → paymentStatus=PAID + status=PROCESSING + timeline PAYMENT_CONFIRMED. Reject → status=CANCELLED + paymentStatus=UNPAID + timeline PAYMENT_REJECTED. reviewNote persisted.
  * GET /api/orders/[code] now returns riskFlags, slipUrl, slipUploadedAt, reviewNote.
- **Verified end-to-end via curl**:
  * Created BANK order → paymentStatus=PENDING_VERIFY + 2 risk flags (VERY_HIGH_VALUE + BANK_HIGH_VALUE_NO_SLIP).
  * Uploaded slip → file saved (84e18502...png), order.slipUrl set, SLIP_UPLOADED timeline entry added.
  * Admin confirm → status=PROCESSING, paymentStatus=PAID.
- `bun run lint`: 0 errors, 0 warnings (useMounted has justified eslint-disable for the canonical mount-detection pattern).

Stage Summary:
- Hydration error fixed (mounted gate on persisted-store-dependent badges).
- All "demo" language removed; site feels real.
- Admin → Cài đặt → "Thanh toán & Ngân hàng" lets merchant configure real bank accounts (with optional QR codes) + MoMo/ZaloPay/VNPay merchant.
- Checkout shows those accounts when customer picks "Chuyển khoản", with transfer instructions + order-code note hint.
- Automatic risk detection flags suspicious orders (high value, duplicate phone, anonymous+COD+high, bulk, short address, suspicious name).
- Customer can upload transfer slip → staff reviews → confirm/reject in admin. Order stays PENDING_VERIFY until confirmed, preventing shipping on unverified payments (scam/legal-risk protection).

---
Task ID: 8
Agent: main
Task: Fix CreditCard import + auto-generate VietQR for bank-payment orders.

Work Log:
- Fixed `CreditCard is not defined` error in admin-view by adding it to the lucide-react import block.
- Created `src/lib/vn-banks.ts`: list of 27 Vietnamese banks with VietQR short codes (vcb, tcb, bid, mb, acb, etc.) + `buildVietQRUrl()` helper that constructs `https://img.vietqr.io/image/{bankCode}-{accountNumber}-compact.png?amount=&addInfo=&accountName=`.
- Updated BankAccount interface to include `bankCode` (VietQR short code).
- Updated BankAccountManager:
  * Replaced free-text "Tên ngân hàng" input with a dropdown Select of all 27 VN banks (with their codes).
  * Bank display name auto-fills from the selected bank code on save.
  * Bank account cards now show a live VietQR preview (auto-generated from bankCode + accountNumber + holder) if no custom QR is uploaded.
- Updated checkout BankTransferInfo component:
  * Added `qrFor()` that auto-builds a VietQR URL per bank using the ORDER TOTAL + ORDER CODE + holder name.
  * Each bank account card now shows a 32×32 QR image that, when scanned by any Vietnamese banking app (Vietcombank, MBBank, BIDV, etc.), auto-fills: bank, account number, exact amount, transfer note (order code), and account holder name.
  * Customer just scans → confirms in their banking app → money lands in the merchant's linked account.
  * Custom uploaded QR (qrUrl) still takes priority if set.
- Verified VietQR service: `https://img.vietqr.io/image/vcb-0123456789-compact.png?amount=8900000&addInfo=AVH-ABC123` returns HTTP 200 + content-type image/png (real scannable QR).
- Settings API returns all 6 payment fields. Lint: 0 errors.

Stage Summary:
- Admin → Cài đặt → "Thanh toán & Ngân hàng" → "Thêm tài khoản ngân hàng" now has a bank dropdown (27 banks) instead of free text.
- When customer picks "Chuyển khoản ngân hàng" at checkout, the system auto-generates a VietQR QR code containing: bank, account number, EXACT ORDER AMOUNT, order code as transfer note, holder name. Customer scans with any VN banking app → pays directly → money goes to merchant's linked account. No manual amount entry needed.
- Server is unstable (4GB RAM, Turbopack OOM) — restart on demand.

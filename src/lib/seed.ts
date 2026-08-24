// Seed data for Nội Thất AVH catalog.
// Centralized so the seed API route + admin "reset data" both reuse it.

import { db } from '@/lib/db'
import { slugify } from '@/lib/format'

export interface SeedImage {
  url: string
  type?: 'image' | 'video'
}

// Product definitions — concise but realistic.
interface ProductSeed {
  name: string
  categorySlug: string
  brand?: string
  description: string
  tags: string[]
  specs: Record<string, string>
  colors: string[]
  materials: string[]
  basePrice: number
  comparePrice?: number
  rating?: number
  reviewCount?: number
  soldCount?: number
  isFeatured?: boolean
  isNew?: boolean
  isFlashSale?: boolean
  images: string[]
  // variants (color + material + sku + price + stock)
  variants: Array<{
    color: string
    material?: string
    size?: string
    sku: string
    price: number
    stock: number
  }>
  // optional related-category blog teaser handled separately
}

const CATEGORIES = [
  { name: 'Phòng Khách', slug: 'phong-khach', icon: 'sofa', imageUrl: '/categories/cat-living.png', filterKeys: ['material', 'color', 'size'] },
  { name: 'Phòng Ngủ', slug: 'phong-ngu', icon: 'bed', imageUrl: '/categories/cat-bedroom.png', filterKeys: ['material', 'color', 'size'] },
  { name: 'Phòng Ăn', slug: 'phong-an', icon: 'utensils', imageUrl: '/categories/cat-dining.png', filterKeys: ['material', 'color', 'size'] },
  { name: 'Đèn Trang Trí', slug: 'den-trang-tri', icon: 'lamp', imageUrl: '/categories/cat-lighting.png', filterKeys: ['material', 'color', 'style'] },
  { name: 'Tủ & Kệ', slug: 'tu-ke', icon: 'shelf', imageUrl: '/products/bookshelf.png', filterKeys: ['material', 'color', 'size'] },
  { name: 'Văn Phòng', slug: 'van-phong', icon: 'desk', imageUrl: '/products/office-desk.png', filterKeys: ['material', 'color', 'size'] },
]

const PRODUCTS: ProductSeed[] = [
  // ---------- Phòng Khách ----------
  {
    name: 'Sofa 3 Chỗ Fabric Xám Hiện Đại AVH-300',
    categorySlug: 'phong-khach',
    brand: 'AVH Home',
    description:
      'Sofa 3 chỗ bọc vải linen cao cấp màu xám, đệm ngồi đa tầng êm ái, khung gỗ thông đã xử lý chống mối mọt. Thiết kế hiện đại, tối giản phù hợp mọi không gian phòng khách từ 15m². Chân kim loại sơn tĩnh điện chắc chắn, dễ lắp ráp.',
    tags: ['modern', 'minimalist', 'linen'],
    specs: {
      'Kích thước': '210 x 95 x 85 cm',
      'Kích thước ngồi': '190 x 60 cm',
      'Chất liệu khung': 'Gỗ thông xử lý',
      'Chất liệu bọc': 'Vải Linen 100%',
      'Chất liệu chân': 'Kim loại sơn tĩnh điện',
      'Màu sắc': 'Xám than',
      'Bảo hành': '24 tháng',
      'Thời gian giao hàng': '5-7 ngày',
    },
    colors: ['Xám', 'Be', 'Xanh navy'],
    materials: ['Vải Linen', 'Khối bông'],
    basePrice: 8900000,
    comparePrice: 12900000,
    rating: 4.8,
    reviewCount: 126,
    soldCount: 540,
    isFeatured: true,
    isFlashSale: true,
    images: ['/products/sofa-grey.png'],
    variants: [
      { color: 'Xám', material: 'Vải Linen', sku: 'AVH-SF300-GRY', price: 8900000, stock: 25 },
      { color: 'Be', material: 'Vải Linen', sku: 'AVH-SF300-BE', price: 9200000, stock: 18 },
      { color: 'Xanh navy', material: 'Vải Linen', sku: 'AVH-SF300-NVY', price: 9500000, stock: 12 },
    ],
  },
  {
    name: 'Bàn Cà Phê Marble Tròn AVH-CT',
    categorySlug: 'phong-khach',
    brand: 'AVH Home',
    description:
      'Bàn cà phê mặt đá marble tròn đường kính 80cm, chân đế khối marble nguyên khối, kết cấu kim loại đen mạ. Sang trọng, bền bỉ, dễ lau chùi. Phù hợp làm điểm nhấn cho phòng khách hiện đại.',
    tags: ['modern', 'marble', 'luxury'],
    specs: {
      'Kích thước': 'Ø80 x 42 cm',
      'Chất liệu mặt': 'Đá Marble tự nhiên',
      'Chất liệu chân': 'Kim loại đen mạ',
      'Trọng lượng': '32 kg',
      'Bảo hành': '12 tháng',
    },
    colors: ['Trắng marble', 'Đen'],
    materials: ['Đá Marble', 'Kim loại'],
    basePrice: 4500000,
    comparePrice: 6200000,
    rating: 4.7,
    reviewCount: 64,
    soldCount: 210,
    isFeatured: true,
    images: ['/products/coffee-table.png'],
    variants: [
      { color: 'Trắng marble', material: 'Đá Marble', sku: 'AVH-CT-WHT', price: 4500000, stock: 14 },
      { color: 'Đen', material: 'Đá Marble', sku: 'AVH-CT-BLK', price: 4700000, stock: 8 },
    ],
  },
  {
    name: 'Armchair Velvet Vàng Mù Tạt AVH-AC',
    categorySlug: 'phong-khach',
    brand: 'AVH Signature',
    description:
      'Ghế bành armchair bọc nhung velvet màu vàng mù tạt, thiết kế mid-century hiện đại. Chân gỗ dẻ cao và thanh mảnh, lưng tựa cong ôm lưng. Điểm nhấn nghệ thuật cho phòng khách hoặc góc đọc sách.',
    tags: ['mid-century', 'velvet', 'accent'],
    specs: {
      'Kích thước': '78 x 80 x 76 cm',
      'Chất liệu bọc': 'Nhung Velvet Ý',
      'Chất liệu chân': 'Gỗ dẻ (beech wood)',
      'Độ cứng đệm': 'Trung bình',
      'Bảo hành': '18 tháng',
    },
    colors: ['Vàng mù tạt', 'Xanh lục', 'Đỏ đô'],
    materials: ['Nhung Velvet', 'Gỗ dẻ'],
    basePrice: 3200000,
    comparePrice: 4500000,
    rating: 4.9,
    reviewCount: 89,
    soldCount: 175,
    isNew: true,
    isFeatured: true,
    images: ['/products/armchair-yellow.png'],
    variants: [
      { color: 'Vàng mù tạt', material: 'Nhung Velvet', sku: 'AVH-AC-YEL', price: 3200000, stock: 22 },
      { color: 'Xanh lục', material: 'Nhung Velvet', sku: 'AVH-AC-GRN', price: 3200000, stock: 15 },
      { color: 'Đỏ đô', material: 'Nhung Velvet', sku: 'AVH-AC-BRG', price: 3400000, stock: 9 },
    ],
  },
  {
    name: 'Kệ TV Gỗ Óc Chọ 1m8 AVH-TV',
    categorySlug: 'phong-khach',
    brand: 'AVH Home',
    description:
      'Kệ TV thấp kiểu console dài 1m8, gỗ óc chó (walnut) tự nhiên mặt vân gỗ đẹp, chân kim loại đen. Có 2 ngăn tủ cánh mở và 1 kệ mở để set-top box, loa soundbar.',
    tags: ['modern', 'walnut', 'console'],
    specs: {
      'Kích thước': '180 x 40 x 45 cm',
      'Chất liệu': 'Gỗ óc chó tự nhiên',
      'Chất liệu chân': 'Kim loại đen',
      'Số ngăn': '3',
      'Bảo hành': '24 tháng',
    },
    colors: ['Nâu walnut', 'Đen'],
    materials: ['Gỗ óc chó', 'Kim loại'],
    basePrice: 5800000,
    comparePrice: 7400000,
    rating: 4.6,
    reviewCount: 41,
    soldCount: 96,
    images: ['/products/tv-stand.png'],
    variants: [
      { color: 'Nâu walnut', material: 'Gỗ óc chó', sku: 'AVH-TV-WAL', price: 5800000, stock: 11 },
      { color: 'Đen', material: 'Gỗ óc chọ sơn', sku: 'AVH-TV-BLK', price: 5600000, stock: 7 },
    ],
  },

  // ---------- Phòng Ngủ ----------
  {
    name: 'Giường King Bọc Đầu Be AVH-KB',
    categorySlug: 'phong-ngu',
    brand: 'AVH Sleep',
    description:
      'Giường king size 1m8 x 2m, đầu giường bọc vải linen màu be êm ái tựa lưng thoải mái. Khung gỗ thông xử lý, chân gỗ cao. Đi kèm nan gỗ tựa nệm (không bao nệm). Thiết kế tối giản, phù hợp phòng ngủ hiện đại.',
    tags: ['modern', 'upholstered', 'linen'],
    specs: {
      'Kích thước giường': '180 x 200 cm',
      'Chiều cao đầu giường': '110 cm',
      'Chất liệu khung': 'Gỗ thông xử lý',
      'Chất liệu bọc đầu': 'Vải Linen + mút bọc',
      'Bảo hành': '36 tháng',
      'Thời gian giao hàng': '7-10 ngày',
    },
    colors: ['Be', 'Xám', 'Xanh navy'],
    materials: ['Vải Linen', 'Gỗ thông'],
    basePrice: 7200000,
    comparePrice: 9800000,
    rating: 4.8,
    reviewCount: 152,
    soldCount: 320,
    isFeatured: true,
    isFlashSale: true,
    images: ['/products/bed-beige.png'],
    variants: [
      { color: 'Be', size: '180x200', sku: 'AVH-KB-BE', price: 7200000, stock: 19 },
      { color: 'Xám', size: '180x200', sku: 'AVH-KB-GRY', price: 7400000, stock: 14 },
      { color: 'Xanh navy', size: '180x200', sku: 'AVH-KB-NVY', price: 7600000, stock: 9 },
    ],
  },
  {
    name: 'Tủ Quần Áo 3 Cánh Trắng AVH-WD',
    categorySlug: 'phong-ngu',
    brand: 'AVH Home',
    description:
      'Tủ quần áo 3 cánh mở phủ laminate trắng mờ mặt phẳng, tay nắm brass vàng đồng. Bên trong chia ngăn treo áo + kệ xếp + ngăn để vali. Kích thước cao 2m1, rộng 1m6.',
    tags: ['modern', 'minimalist', 'storage'],
    specs: {
      'Kích thước': '160 x 55 x 210 cm',
      'Chất liệu': 'Gỗ MDF phủ Laminate',
      'Tay nắm': 'Brass vàng đồng',
      'Số cánh': '3',
      'Bảo hành': '24 tháng',
    },
    colors: ['Trắng mờ', 'Xám stone'],
    materials: ['MDF Laminate'],
    basePrice: 6400000,
    comparePrice: 8200000,
    rating: 4.5,
    reviewCount: 73,
    soldCount: 188,
    images: ['/products/wardrobe-white.png'],
    variants: [
      { color: 'Trắng mờ', sku: 'AVH-WD-WHT', price: 6400000, stock: 16 },
      { color: 'Xám stone', sku: 'AVH-WD-STN', price: 6600000, stock: 10 },
    ],
  },
  {
    name: 'Bàn Đầu Giường Gỗ Dẻ AVH-NS',
    categorySlug: 'phong-ngu',
    brand: 'AVH Home',
    description:
      'Bàn đầu giường nhỏ gọn bằng gỗ dẻ sáng màu, 1 ngăn kéo + 1 kệ mở. Phù hợp đặt đèn ngủ, sách, điện thoại. Chân gỗ cao sạch sẽ, dễ lau dọn.',
    tags: ['scandinavian', 'minimalist', 'oak'],
    specs: {
      'Kích thước': '45 x 38 x 55 cm',
      'Chất liệu': 'Gỗ dẻ (beech)',
      'Số ngăn kéo': '1',
      'Bảo hành': '18 tháng',
    },
    colors: ['Gỗ tự nhiên', 'Trắng'],
    materials: ['Gỗ dẻ'],
    basePrice: 1450000,
    comparePrice: 1900000,
    rating: 4.6,
    reviewCount: 58,
    soldCount: 240,
    isNew: true,
    images: ['/products/nightstand.png'],
    variants: [
      { color: 'Gỗ tự nhiên', sku: 'AVH-NS-OAK', price: 1450000, stock: 28 },
      { color: 'Trắng', sku: 'AVH-NS-WHT', price: 1500000, stock: 20 },
    ],
  },

  // ---------- Phòng Ăn ----------
  {
    name: 'Bộ Bàn Ăn 4 Ghế Gỗ Oak AVH-DT',
    categorySlug: 'phong-an',
    brand: 'AVH Dining',
    description:
      'Bộ bàn ăn gồm 1 bàn + 4 ghế gỗ oak sáng màu kiểu Scandinavian. Mặt bàn melamine chống trầy, chân gỗ dẻ vát chéo chắc chắn. Ghế đệm vải xám thoải mái.',
    tags: ['scandinavian', 'oak', 'set'],
    specs: {
      'Kích thước bàn': '140 x 80 x 75 cm',
      'Kích thước ghế': '45 x 52 x 85 cm',
      'Chất liệu bàn': 'Gỗ oak + melamine',
      'Chất liệu ghế': 'Gỗ dẻ + vải',
      'Số ghế đi kèm': '4',
      'Bảo hành': '24 tháng',
    },
    colors: ['Gỗ sáng', 'Nâu đậm'],
    materials: ['Gỗ oak', 'Gỗ dẻ'],
    basePrice: 8800000,
    comparePrice: 12500000,
    rating: 4.7,
    reviewCount: 94,
    soldCount: 130,
    isFeatured: true,
    isFlashSale: true,
    images: ['/products/dining-set.png'],
    variants: [
      { color: 'Gỗ sáng', sku: 'AVH-DT-OAK', price: 8800000, stock: 13 },
      { color: 'Nâu đậm', sku: 'AVH-DT-WAL', price: 9200000, stock: 8 },
    ],
  },
  {
    name: 'Ghế Ăn Bentwood Cặp 2 Chiếc AVH-DC',
    categorySlug: 'phong-an',
    brand: 'AVH Dining',
    description:
      'Cặp 2 ghế ăn kiểu bentwood (gỗ uốn cong) khung oak sáng màu, đệm ngồi vải xám êm ái. Thiết kế mảnh, nhẹ, dễ gấp gọn. Tối ưu cho phòng ăn nhỏ.',
    tags: ['bentwood', 'scandinavian', 'pair'],
    specs: {
      'Kích thước': '45 x 52 x 85 cm',
      'Chất liệu khung': 'Gỗ oak uốn cong',
      'Chất liệu đệm': 'Vải linen + mút bọc',
      'Số lượng': '2 chiếc / bộ',
      'Bảo hành': '18 tháng',
    },
    colors: ['Gỗ + Xám', 'Gỗ + Be'],
    materials: ['Gỗ oak', 'Vải linen'],
    basePrice: 2200000,
    comparePrice: 3100000,
    rating: 4.5,
    reviewCount: 36,
    soldCount: 88,
    isNew: true,
    images: ['/products/dining-chair.png'],
    variants: [
      { color: 'Gỗ + Xám', sku: 'AVH-DC-GRY', price: 2200000, stock: 30 },
      { color: 'Gỗ + Be', sku: 'AVH-DC-BE', price: 2200000, stock: 24 },
    ],
  },

  // ---------- Đèn Trang Trí ----------
  {
    name: 'Đèn Trầm Brass Cổ Điển AVH-LP',
    categorySlug: 'den-trang-tri',
    brand: 'AVH Light',
    description:
      'Đèn trầm (pendant lamp) thân brass vàng đồng, chụp thủy tinh mờ trắng hình cầu. Phù hợp treo trên bàn ăn hoặc quầy bar. Đui E27, không bao bóng.',
    tags: ['classic', 'brass', 'pendant'],
    specs: {
      'Kích thước': 'Ø25 x 35 cm (chụp)',
      'Dây cáp': '1.5m (có thể điều chỉnh)',
      'Chất liệu': 'Brass + thủy tinh',
      'Loại bóng': 'E27 (tối đa 60W)',
      'Bảo hành': '12 tháng',
    },
    colors: ['Brass', 'Đen mờ'],
    materials: ['Brass', 'Thủy tinh'],
    basePrice: 1350000,
    comparePrice: 1800000,
    rating: 4.8,
    reviewCount: 47,
    soldCount: 165,
    isFeatured: true,
    images: ['/products/lamp-brass.png'],
    variants: [
      { color: 'Brass', sku: 'AVH-LP-BRS', price: 1350000, stock: 35 },
      { color: 'Đen mờ', sku: 'AVH-LP-BLK', price: 1400000, stock: 22 },
    ],
  },
  {
    name: 'Đèn Sàn Arc Marble AVH-FL',
    categorySlug: 'den-trang-tri',
    brand: 'AVH Light',
    description:
      'Đèn sàn kiểu cung (arc lamp) đế khối marble trắng, thân kim loại đen uốn cong. Phù hợp cho góc đọc sách bên sofa. Cao 1m6, chụp đầu xoay điều chỉnh được.',
    tags: ['modern', 'arc', 'marble'],
    specs: {
      'Chiều cao': '160 cm',
      'Đường kính đế': '30 cm',
      'Chất liệu đế': 'Đá Marble trắng',
      'Chất liệu thân': 'Kim loại đen mạ',
      'Loại bóng': 'E27 (tối đa 60W)',
      'Bảo hành': '12 tháng',
    },
    colors: ['Đen + marble trắng'],
    materials: ['Kim loại', 'Đá marble'],
    basePrice: 1950000,
    comparePrice: 2700000,
    rating: 4.7,
    reviewCount: 31,
    soldCount: 76,
    images: ['/products/floor-lamp.png'],
    variants: [
      { color: 'Đen + marble trắng', sku: 'AVH-FL-DEF', price: 1950000, stock: 18 },
    ],
  },

  // ---------- Tủ & Kệ ----------
  {
    name: 'Kệ Sách 5 Tầng Gỗ Óc Chọ AVH-BS',
    categorySlug: 'tu-ke',
    brand: 'AVH Home',
    description:
      'Kệ sách 5 tầng gỗ óc chọ (walnut) tự nhiên, kết cấu vát chéo khung thép đen công nghiệp. Mỗi tầng chịu tải 25kg. Thiết kế mở, phù hợp sách + decor.',
    tags: ['industrial', 'walnut', 'open-shelf'],
    specs: {
      'Kích thước': '80 x 30 x 180 cm',
      'Số tầng': '5',
      'Chất liệu': 'Gỗ óc chọ + thép sơn tĩnh điện',
      'Tải trọng mỗi tầng': '25 kg',
      'Bảo hành': '24 tháng',
    },
    colors: ['Walnut + đen', 'Walnut + trắng'],
    materials: ['Gỗ óc chọ', 'Thép'],
    basePrice: 3800000,
    comparePrice: 5200000,
    rating: 4.6,
    reviewCount: 52,
    soldCount: 140,
    isFeatured: true,
    images: ['/products/bookshelf.png'],
    variants: [
      { color: 'Walnut + đen', sku: 'AVH-BS-BLK', price: 3800000, stock: 17 },
      { color: 'Walnut + trắng', sku: 'AVH-BS-WHT', price: 3900000, stock: 9 },
    ],
  },
  {
    name: 'Thảm Dệt Geometry Be-Avocado AVH-RG',
    categorySlug: 'tu-ke',
    brand: 'AVH Decor',
    description:
      'Thảm dệt tay họa tiết geometry boho, tông be + terracotta. Kích thước 160x230cm, chất liệu sợi tổng hợp mềm, chống trượt đáy.',
    tags: ['boho', 'rug', 'handmade'],
    specs: {
      'Kích thước': '160 x 230 cm',
      'Chất liệu': 'Sợi tổng hợp (polypropylene)',
      'Họa tiết': 'Geometry boho',
      'Chống trượt': 'Có (đế latex)',
      'Bảo hành': '6 tháng',
    },
    colors: ['Be + terracotta', 'Xám + trắng'],
    materials: ['Sợi tổng hợp'],
    basePrice: 980000,
    comparePrice: 1400000,
    rating: 4.5,
    reviewCount: 28,
    soldCount: 92,
    isNew: true,
    images: ['/products/rug-pattern.png'],
    variants: [
      { color: 'Be + terracotta', sku: 'AVH-RG-BE', price: 980000, stock: 24 },
      { color: 'Xám + trắng', sku: 'AVH-RG-GRY', price: 980000, stock: 18 },
    ],
  },

  // ---------- Văn Phòng ----------
  {
    name: 'Bàn Làm Việc Gỗ Oak AVH-OD',
    categorySlug: 'van-phong',
    brand: 'AVH Work',
    description:
      'Bàn làm việc gỗ oak sáng màu mặt melamine chống trầy, chân kim loại đen hình chữ A vững chãi. Có lỗ luồn dây cáp. Rộng 1m2, sâu 60cm.',
    tags: ['modern', 'minimalist', 'workstation'],
    specs: {
      'Kích thước': '120 x 60 x 75 cm',
      'Chất liệu mặt': 'Gỗ oak + melamine',
      'Chất liệu chân': 'Kim loại đen',
      'Lỗ luồn dây': '1 lỗ',
      'Bảo hành': '24 tháng',
    },
    colors: ['Gỗ sáng', 'Trắng'],
    materials: ['Gỗ oak', 'Kim loại'],
    basePrice: 2900000,
    comparePrice: 3900000,
    rating: 4.7,
    reviewCount: 69,
    soldCount: 215,
    isFeatured: true,
    isFlashSale: true,
    images: ['/products/office-desk.png'],
    variants: [
      { color: 'Gỗ sáng', sku: 'AVH-OD-OAK', price: 2900000, stock: 20 },
      { color: 'Trắng', sku: 'AVH-OD-WHT', price: 2950000, stock: 14 },
    ],
  },
]

// Sample reviews seeded for select products
const SAMPLE_REVIEWS = [
  { rating: 5, title: 'Sản phẩm đúng mô tả', content: 'Hàng giao nhanh, đóng gói kỹ, sofa êm và màu y hình. Sẽ ủng hộ tiếp!' },
  { rating: 4, title: 'Đẹp nhưng lắp ráp mất thời gian', content: 'Nội thất đẹp, chắc chắn. Đóng gói nhiều lớp nên mở ra cũng hơi mất công.' },
  { rating: 5, title: 'Cực kỳ hài lòng', content: 'Mình mua cho căn hộ mới, mọi khách đến chơi đều khen. Chất lượng vượt mức mong đợi.' },
  { rating: 5, title: 'Giá hợp lý', content: 'So với các bên khác thì AVH có giá tốt và bảo hành rõ ràng. Recommend!' },
  { rating: 4, title: 'Tốt nhưng màu hơi khác', content: 'Sản phẩm chất lượng tốt, nhưng màu thực tế hơi đậm hơn ảnh một chút. Vẫn chấp nhận được.' },
]

// Banners for homepage hero
const BANNERS = [
  {
    title: 'Bộ Sưu Tập Mùa Thu - Giảm đến 35%',
    imageUrl: '/banners/hero-1.png',
    mobileImageUrl: '/banners/hero-1.png',
    link: 'shop',
    sortOrder: 0,
    active: true,
  },
  {
    title: 'Phòng Ngủ Của Bạn - Ưu đãi 25%',
    imageUrl: '/banners/hero-2.png',
    mobileImageUrl: '/banners/hero-2.png',
    link: 'shop?cat=phong-ngu',
    sortOrder: 1,
    active: true,
  },
  {
    title: 'Phòng Ăn Ấm Cúng - Bộ bàn ghế giảm 20%',
    imageUrl: '/banners/hero-3.png',
    mobileImageUrl: '/banners/hero-3.png',
    link: 'shop?cat=phong-an',
    sortOrder: 2,
    active: true,
  },
]

const VOUCHERS = [
  { code: 'AVH10', description: 'Giảm 10% cho đơn từ 3 triệu', type: 'PERCENT', value: 10, minOrder: 3000000, maxDiscount: 500000 },
  { code: 'AVH200K', description: 'Giảm 200K cho đơn từ 5 triệu', type: 'FIXED', value: 200000, minOrder: 5000000, maxDiscount: null },
  { code: 'FREESHIP', description: 'Miễn phí ship tối đa 150K', type: 'FIXED', value: 150000, minOrder: 1000000, maxDiscount: null },
]

const BLOG_POSTS = [
  {
    title: '5 Mẹo Bố Trí Nội Thất Cho Căn Hộ Nhỏ',
    slug: 'bo-tri-noi-that-can-ho-nho',
    excerpt: 'Cách tận dụng không gian, chọn đồ đa năng và dùng gương để phòng trông rộng hơn.',
    content: 'Khi sống trong căn hộ nhỏ, mỗi mét vuông đều quý. Dưới đây là 5 nguyên tắc chúng tôi rút ra sau hàng trăm dự án thi công...\n\n## 1. Chọn đồ đa năng\nMột sofa có thể mở thành giường, bàn cà phê có ngăn kéo, giường có ngăn chứa...\n\n## 2. Dùng gương lớn\nGương phản chiếu ánh sáng và tạo cảm giác phòng sâu hơn. Đặt đối diện cửa sổ để tận dụng tối đa.\n\n## 3. Màu sáng\nTông be, trắng, kem giúp phòng bừng sáng. Đừng dùng quá 3 màu trong một phòng.\n\n## 4. Tận dụng chiều cao\nKệ trần, kệ treo tường giải phóng sàn.\n\n## 5. Đừng nhồi nhét\nĐể ít đồ hơn bạn nghĩ mình cần. Khoảng trống cũng là thiết kế.',
    coverUrl: '/blog/blog-1.png',
    tags: ['decor', 'small-space'],
  },
  {
    title: 'Cách Chọn Vải Sofa Phù Hợp Phong Cách Sống',
    slug: 'chon-vai-sofa-phong-cach',
    excerpt: 'Linen, velvet, cotton hay da? Phân tích ưu nhược điểm từng loại cho từng hoàn cảnh sống.',
    content: 'Vải bọc sofa quyết định 70% cảm giác ngồi và độ bền...\n\n## Linen\nThoáng mát, sang trọng, nhưng dễ nhăn và kỵ nước. Phù hợp nhà ít trẻ nhỏ.\n\n## Velvet\nSang trọng, êm ái, nhưng giữ nhiệt. Phù hợp phòng có máy lạnh.\n\n## Cotton\nDễ vệ sinh, giá mềm, nhưng mau xù và bạc màu.\n\n## Da (PU hoặc thật)\nDễ lau, bền, nhưng ngồi nóng mùa hè. Phù hợp khí hậu mát.',
    coverUrl: '/blog/blog-2.png',
    tags: ['sofa', 'fabric'],
  },
  {
    title: 'Ánh Sáng Trong Phòng Ngủ - Bí Quyết Ngủ Ngon',
    slug: 'anh-sang-phong-ngu-ngu-ngon',
    excerpt: 'Đèn ấm vào ban đêm, ánh sáng ban ngày, và vị trí đặt đèn ảnh hưởng giấc ngủ của bạn.',
    content: 'Ánh sáng là yếu tố then chốt cho giấc ngủ...\n## Đèn ngủ ấm vàng\nNhiệt màu 2700-3000K giúp cơ thể tiết melatonin.\n## Tránh đèn LED xanh\nLam xanh ức chế melatonin, gây khó ngủ.\n## Tận dụng ban ngày\nRèm mỏng để nắng xuyên qua vào buổi sáng giúp đồng hồ sinh học ổn định.',
    coverUrl: '/blog/blog-3.png',
    tags: ['lighting', 'bedroom'],
  },
]

/**
 * Seed the database. Idempotent: skips entities that already exist.
 * Returns counts of what was created.
 */
export async function seedDatabase(force = false) {
  const result = {
    categories: 0,
    products: 0,
    variants: 0,
    media: 0,
    reviews: 0,
    banners: 0,
    vouchers: 0,
    blog: 0,
    users: 0,
    flashSale: 0,
  }

  // Categories
  const existingCats = await db.category.count()
  if (force || existingCats === 0) {
    if (force) await db.category.deleteMany()
    for (const c of CATEGORIES) {
      await db.category.create({
        data: {
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          imageUrl: c.imageUrl,
          filterKeys: JSON.stringify(c.filterKeys),
        },
      })
      result.categories++
    }
  }

  // Admin user (email: admin@avh.vn / pass: admin123) — only if no admin exists
  const adminExists = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!adminExists) {
    // NOTE: in production use bcrypt; for demo we store a simple hash placeholder.
    // The /api/auth/login route compares plain text to this stored value for demo only.
    await db.user.create({
      data: {
        email: 'admin@avh.vn',
        name: 'Quản trị AVH',
        role: 'ADMIN',
        passwordHash: 'admin123',
        authProviders: 'email',
        loyaltyPoints: 0,
        memberTier: 'PLATINUM',
      },
    })
    result.users++
  }

  // Sample customer user
  const customerExists = await db.user.findFirst({ where: { role: 'CUSTOMER' } })
  if (!customerExists) {
    await db.user.create({
      data: {
        email: 'khach@avh.vn',
        name: 'Khách Hàng Demo',
        role: 'CUSTOMER',
        passwordHash: 'khach123',
        authProviders: 'email',
        loyaltyPoints: 1250,
        memberTier: 'GOLD',
      },
    })
    result.users++
  }

  // Products + variants + media
  const existingProducts = await db.product.count()
  if (force || existingProducts === 0) {
    if (force) {
      await db.productMedia.deleteMany()
      await db.productVariant.deleteMany()
      await db.product.deleteMany()
    }
    for (const p of PRODUCTS) {
      const category = await db.category.findUnique({ where: { slug: p.categorySlug } })
      if (!category) continue
      const slug = slugify(p.name)
      const created = await db.product.create({
        data: {
          name: p.name,
          slug,
          categoryId: category.id,
          brand: p.brand || 'AVH Home',
          description: p.description,
          tags: JSON.stringify(p.tags),
          specs: JSON.stringify(p.specs),
          colors: JSON.stringify(p.colors),
          materials: JSON.stringify(p.materials),
          basePrice: p.basePrice,
          comparePrice: p.comparePrice ?? null,
          discountPct: p.comparePrice ? Math.round(((p.comparePrice - p.basePrice) / p.comparePrice) * 100) : 0,
          rating: p.rating ?? 0,
          reviewCount: p.reviewCount ?? 0,
          soldCount: p.soldCount ?? 0,
          isFeatured: p.isFeatured ?? false,
          isNew: p.isNew ?? false,
          isFlashSale: p.isFlashSale ?? false,
          published: true,
        },
      })
      result.products++

      // media
      for (let i = 0; i < p.images.length; i++) {
        await db.productMedia.create({
          data: {
            productId: created.id,
            url: p.images[i],
            type: 'image',
            sortOrder: i,
          },
        })
        result.media++
      }

      // variants
      for (const v of p.variants) {
        await db.productVariant.create({
          data: {
            productId: created.id,
            sku: v.sku,
            color: v.color,
            material: v.material,
            size: v.size,
            price: v.price,
            stock: v.stock,
          },
        })
        result.variants++
      }

      // sample reviews for featured/new products only
      if (p.isFeatured || p.isNew) {
        const numReviews = Math.min(3, Math.floor((p.reviewCount ?? 0) / 30))
        for (let i = 0; i < numReviews; i++) {
          const r = SAMPLE_REVIEWS[i % SAMPLE_REVIEWS.length]
          const customers = await db.user.findMany({ where: { role: 'CUSTOMER' } })
          const customer = customers[Math.floor(Math.random() * customers.length)]
          if (!customer) continue
          await db.review.create({
            data: {
              productId: created.id,
              userId: customer.id,
              rating: r.rating,
              title: r.title,
              content: r.content,
              images: JSON.stringify([]),
              verified: true,
              status: 'PUBLISHED',
              reply: i === 0 ? 'Cảm ơn anh/chị đã tin tưởng AVH! Chúc anh/chị nhiều niềm vui với món đồ mới.' : null,
              repliedAt: i === 0 ? new Date() : null,
            },
          })
          result.reviews++
        }
      }
    }
  }

  // Banners
  const existingBanners = await db.banner.count()
  if (force || existingBanners === 0) {
    if (force) await db.banner.deleteMany()
    for (const b of BANNERS) {
      await db.banner.create({ data: { ...b } })
      result.banners++
    }
  }

  // Vouchers
  const existingVouchers = await db.voucher.count()
  if (force || existingVouchers === 0) {
    if (force) await db.voucher.deleteMany()
    for (const v of VOUCHERS) {
      await db.voucher.create({
        data: {
          code: v.code,
          description: v.description,
          type: v.type,
          value: v.value,
          minOrder: v.minOrder,
          maxDiscount: v.maxDiscount,
          usageLimit: 1000,
          usedCount: 0,
          startAt: new Date(Date.now() - 86400000),
          endAt: new Date(Date.now() + 90 * 86400000),
          active: true,
        },
      })
      result.vouchers++
    }
  }

  // Flash sale
  const existingFlash = await db.flashSale.count()
  if (force || existingFlash === 0) {
    if (force) await db.flashSale.deleteMany()
    const flashSaleProducts = await db.product.findMany({ where: { isFlashSale: true } })
    const fs = await db.flashSale.create({
      data: {
        name: 'Flash Sale Cuối Tuần',
        startAt: new Date(),
        endAt: new Date(Date.now() + 2 * 86400000),
        active: true,
      },
    })
    await db.flashSale.update({
      where: { id: fs.id },
      data: { products: { connect: flashSaleProducts.map((p) => ({ id: p.id })) } },
    })
    result.flashSale++
  }

  // Blog
  const existingBlog = await db.blogPost.count()
  if (force || existingBlog === 0) {
    if (force) await db.blogPost.deleteMany()
    const admin = await db.user.findFirst({ where: { role: 'ADMIN' } })
    for (const post of BLOG_POSTS) {
      await db.blogPost.create({
        data: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverUrl: post.coverUrl,
          tags: JSON.stringify(post.tags),
          authorId: admin?.id,
          published: true,
        },
      })
      result.blog++
    }
  }

  return result
}

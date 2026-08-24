/**
 * Calculate shipping fee based on province + subtotal + installation flag.
 * Rates are admin-configurable via Settings → "Vận chuyển" tab.
 * Falls back to hardcoded defaults if settings aren't loaded.
 */
const NORTH_PROVINCES = ['Hà Nội', 'Hà Nam', 'Bắc Ninh', 'Hải Phòng', 'Quảng Ninh', 'Vĩnh Phúc']
const SOUTH_PROVINCES = ['Hồ Chí Minh', 'Bình Dương', 'Đồng Nai', 'Long An', 'Bà Rịa - Vũng Tàu']

export async function shippingFeeFor(
  province: string,
  subtotal: number,
  needsInstallation: boolean
): Promise<number> {
  // Read rates from DB settings (admin-configurable)
  let baseCity = 80000
  let baseProvince = 120000
  let installationFee = 250000
  let freeThreshold = 3_000_000

  try {
    const { db } = await import('@/lib/db')
    const settings = await db.setting.findMany()
    const get = (key: string) => {
      const s = settings.find((x) => x.key === key)
      return s?.value ? Number(s.value) : undefined
    }
    baseCity = get('shipping_base_fee_city') ?? baseCity
    baseProvince = get('shipping_base_fee_province') ?? baseProvince
    installationFee = get('shipping_installation_fee') ?? installationFee
    freeThreshold = get('shipping_free_threshold') ?? freeThreshold
  } catch {
    // use defaults if DB unavailable
  }

  const isMajorCity = NORTH_PROVINCES.includes(province) || SOUTH_PROVINCES.includes(province)
  let base = isMajorCity ? baseCity : baseProvince
  const freeShipThreshold = isMajorCity ? freeThreshold : freeThreshold + 2_000_000
  if (subtotal >= freeShipThreshold) base = 0
  if (needsInstallation) base += installationFee
  return base
}

/** Sync version — uses hardcoded defaults (for client-side estimates before settings load). */
export function shippingFeeForSync(
  province: string,
  subtotal: number,
  needsInstallation: boolean
): number {
  let base = 120000
  if (NORTH_PROVINCES.includes(province) || SOUTH_PROVINCES.includes(province)) {
    base = 80000
  }
  const freeThreshold = NORTH_PROVINCES.includes(province) || SOUTH_PROVINCES.includes(province) ? 3_000_000 : 5_000_000
  if (subtotal >= freeThreshold) base = 0
  if (needsInstallation) base += 250000
  return base
}

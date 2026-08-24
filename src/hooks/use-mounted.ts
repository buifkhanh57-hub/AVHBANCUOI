'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true only after the component has mounted on the client.
 *
 * Why: persisted Zustand stores (cart, wishlist, compare, auth) read from
 * localStorage, which is only available client-side. During SSR the store
 * has default values (empty cart → count 0); on the client the persisted
 * value is loaded synchronously at store creation, so the first client
 * render can differ from the server HTML → React throws a hydration error
 * for any UI that depends on those counts (e.g. the cart badge).
 *
 * Gating those bits behind `mounted` makes server and first client render
 * agree; the real count appears a tick later (invisible to the user).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  // This is the canonical "detect client mount" pattern; the setState-in-effect
  // rule is intentionally suppressed here because there is no render-phase
  // alternative (the value must be false on the server, true after mount).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  return mounted
}

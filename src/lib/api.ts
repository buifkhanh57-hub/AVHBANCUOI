// Lightweight typed fetch wrapper for the AVH API.
// Automatically attaches the JWT auth token (from the auth store) to every
// request, so admin endpoints can verify the caller's identity + role.

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

/** Read the auth token from localStorage (avoids circular import with zustand). */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('avh-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.user?.token || null
  } catch {
    return null
  }
}

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Attach JWT token for authentication — admin routes verify this.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  })

  // handle non-JSON gracefully
  const text = await res.text()
  let body: ApiResponse<T>
  try {
    body = text ? JSON.parse(text) : { success: false }
  } catch {
    throw new ApiError(`Phản hồi không hợp lệ từ máy chủ`, res.status)
  }

  if (!res.ok || !body.success) {
    throw new ApiError(body.error || body.message || `Lỗi ${res.status}`, res.status)
  }
  return (body.data ?? (body as unknown as T))
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}

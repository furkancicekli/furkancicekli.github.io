async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
}

async function put(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
}

async function del(path: string): Promise<Response> {
  return fetch(path, { method: 'DELETE', credentials: 'same-origin' })
}

export type ProductStatus = 'draft' | 'published' | 'sold'
export type Lang = 'tr' | 'en' | 'ar'

export interface ProductListItem {
  id: number
  slug: string
  serialNo: string | null
  status: ProductStatus
  name: string | null
  price: number | null
  mediaCount: number
  createdAt: number
}

export interface ProductTranslation {
  name: string | null
  description: string | null
  story: string | null
}

export interface ProductMediaItem {
  id: number
  type: 'image' | 'video'
  r2Key: string
  kind: 'gallery' | 'raw_material' | 'process'
  sort: number
}

export interface ProcessStep {
  id: number
  sort: number
  texts: Partial<Record<Lang, string>>
}

export interface ProductDetail {
  id: number
  slug: string
  serialNo: string | null
  status: ProductStatus
  material: string | null
  size: string | null
  price: number | null
  createdAt: number
  updatedAt: number
  translations: Partial<Record<Lang, ProductTranslation>>
  media: ProductMediaItem[]
  steps: ProcessStep[]
}

export interface ProductInput {
  slug: string
  serialNo?: string | null
  status: ProductStatus
  material?: string | null
  size?: string | null
  price?: number | null
  translations: Partial<Record<Lang, ProductTranslation>>
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await post('/api/auth/login', { email, password })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    // fetch reddi (ağ hatası): çağıran taraf busy state'te asılı kalmasın
    return { ok: false, error: 'network' }
  }
}

export async function logout(): Promise<void> {
  try {
    await post('/api/auth/logout', {})
  } catch {
    // ağ hatasında sessiz geç — çağıran zaten login'e yönlendirir
  }
}

export async function fetchMe(): Promise<{ email: string } | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!res.ok) return null
    return (await res.json()) as { email: string }
  } catch {
    return null
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await post('/api/admin/password', { currentPassword, newPassword })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function listProducts(): Promise<
  { ok: true; data: ProductListItem[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/admin/products', { credentials: 'same-origin' })
    if (res.ok) {
      const data = (await res.json()) as { products: ProductListItem[] }
      return { ok: true, data: data.products }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function getProduct(
  id: number,
): Promise<{ ok: true; data: ProductDetail } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/products/${id}`, { credentials: 'same-origin' })
    if (res.ok) {
      const data = (await res.json()) as ProductDetail
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function createProduct(
  input: ProductInput,
): Promise<{ ok: true; data: ProductDetail } | { ok: false; error: string }> {
  try {
    const res = await post('/api/admin/products', input)
    if (res.ok) {
      const data = (await res.json()) as ProductDetail
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function updateProduct(
  id: number,
  input: ProductInput,
): Promise<{ ok: true; data: ProductDetail } | { ok: false; error: string }> {
  try {
    const res = await put(`/api/admin/products/${id}`, input)
    if (res.ok) {
      const data = (await res.json()) as ProductDetail
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function deleteProduct(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await del(`/api/admin/products/${id}`)
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

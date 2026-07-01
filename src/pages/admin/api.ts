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

export async function uploadProductMedia(
  productId: number,
  file: File,
  kind: ProductMediaItem['kind'],
): Promise<{ ok: true; data: ProductMediaItem } | { ok: false; error: string }> {
  try {
    const form = new FormData()
    form.set('file', file)
    form.set('kind', kind)
    // content-type ayarlanmaz — tarayıcı multipart boundary'yi kendi ekler
    const res = await fetch(`/api/admin/products/${productId}/media`, {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
    if (res.ok) {
      const data = (await res.json()) as ProductMediaItem
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function patchMedia(
  mediaId: number,
  patch: { kind?: ProductMediaItem['kind']; sort?: number },
): Promise<{ ok: true; data: ProductMediaItem } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/media/${mediaId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      credentials: 'same-origin',
    })
    if (res.ok) {
      const data = (await res.json()) as ProductMediaItem
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function deleteMedia(mediaId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await del(`/api/admin/media/${mediaId}`)
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function addStep(
  productId: number,
  texts: Partial<Record<Lang, string>>,
  sort?: number,
): Promise<{ ok: true; data: ProcessStep } | { ok: false; error: string }> {
  try {
    const res = await post(`/api/admin/products/${productId}/steps`, sort === undefined ? { texts } : { texts, sort })
    if (res.ok) {
      const data = (await res.json()) as ProcessStep
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function updateStep(
  stepId: number,
  texts: Partial<Record<Lang, string>>,
  sort: number,
): Promise<{ ok: true; data: ProcessStep } | { ok: false; error: string }> {
  try {
    const res = await put(`/api/admin/steps/${stepId}`, { texts, sort })
    if (res.ok) {
      const data = (await res.json()) as ProcessStep
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function deleteStep(stepId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await del(`/api/admin/steps/${stepId}`)
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export interface FaqTranslation {
  question: string
  answer: string
}

export interface Faq {
  id: number
  sort: number
  translations: Partial<Record<Lang, FaqTranslation>>
}

export interface FaqInput {
  translations: Partial<Record<Lang, FaqTranslation>>
  sort?: number
}

export async function listFaqs(): Promise<{ ok: true; data: Faq[] } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/admin/faqs', { credentials: 'same-origin' })
    if (res.ok) {
      const data = (await res.json()) as { faqs: Faq[] }
      return { ok: true, data: data.faqs }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function createFaq(input: FaqInput): Promise<{ ok: true; data: Faq } | { ok: false; error: string }> {
  try {
    const res = await post('/api/admin/faqs', input)
    if (res.ok) {
      const data = (await res.json()) as Faq
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function updateFaq(
  id: number,
  input: FaqInput,
): Promise<{ ok: true; data: Faq } | { ok: false; error: string }> {
  try {
    const res = await put(`/api/admin/faqs/${id}`, input)
    if (res.ok) {
      const data = (await res.json()) as Faq
      return { ok: true, data }
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function deleteFaq(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await del(`/api/admin/faqs/${id}`)
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'unknown' }
  } catch {
    return { ok: false, error: 'network' }
  }
}

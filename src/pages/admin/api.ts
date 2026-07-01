async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
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

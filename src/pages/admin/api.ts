async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await post('/api/auth/login', { email, password })
  if (res.ok) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, error: data.error ?? 'unknown' }
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout', {})
}

export async function fetchMe(): Promise<{ email: string } | null> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (!res.ok) return null
  return (await res.json()) as { email: string }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await post('/api/admin/password', { currentPassword, newPassword })
  if (res.ok) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, error: data.error ?? 'unknown' }
}

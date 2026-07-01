export const SESSION_COOKIE = 'sid'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 gün

export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function sessionCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: 'Lax' as const, path: '/', maxAge }
}

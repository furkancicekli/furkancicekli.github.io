const ITERATIONS = 100_000

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return false
  let salt: Uint8Array, expected: Uint8Array
  try {
    salt = fromB64(parts[2])
    expected = fromB64(parts[3])
  } catch {
    return false
  }
  const actual = await derive(password, salt, iterations)
  if (actual.length !== expected.length) return false
  // sabit-zamanlı karşılaştırma
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

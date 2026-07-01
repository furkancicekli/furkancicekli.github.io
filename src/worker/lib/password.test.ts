import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('hashes and verifies a correct password', async () => {
    const stored = await hashPassword('s3cret-pass')
    expect(stored.startsWith('pbkdf2$')).toBe(true)
    expect(await verifyPassword('s3cret-pass', stored)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong', stored)).toBe(false)
  })

  it('produces unique salts per hash', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })

  it('rejects malformed stored values without throwing', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$abc$!!$!!')).toBe(false)
  })
})

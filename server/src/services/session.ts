import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_SECONDS = 2592000

export function sessionKey(sid: string): string {
  return `sess:${sid}`
}

export function signSid(secret: string, sid: string): string {
  return createHmac('sha256', secret).update(sid).digest('base64url')
}

export function createSessionToken(secret: string, sid: string): string {
  return `${sid}.${signSid(secret, sid)}`
}

export function verifySessionToken(secret: string, token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const sid = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = signSid(secret, sid)
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return null
  if (!timingSafeEqual(left, right)) return null
  return sid
}

export function encodeSid(bytes: Buffer): string {
  return bytes.toString('base64url')
}

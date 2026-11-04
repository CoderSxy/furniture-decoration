import { ApiError } from '../errors.ts'
import type { RedisPort } from '../db/ports.ts'

export async function hitRateLimit(
  redis: RedisPort,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  if (count > limit) throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁')
}

export function loginRateKey(ip: string): string {
  return `rl:login:${ip}`
}

export function syncRateKey(userId: string): string {
  return `rl:sync:${userId}`
}

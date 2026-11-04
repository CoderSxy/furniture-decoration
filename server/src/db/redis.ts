import { Redis } from 'ioredis'
import type { Env } from '../env.ts'
import type { RedisPort } from './ports.ts'

export function createRedis(env: Env): RedisPort {
  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD.length > 0 ? env.REDIS_PASSWORD : undefined,
    db: env.REDIS_DB,
  })
  return {
    get: (key) => client.get(key),
    async set(key, value, ttlSeconds) {
      if (ttlSeconds > 0) await client.set(key, value, 'EX', ttlSeconds)
      else await client.set(key, value)
    },
    async del(key) {
      await client.del(key)
    },
    async expire(key, ttlSeconds) {
      await client.expire(key, ttlSeconds)
    },
    incr: (key) => client.incr(key),
  }
}

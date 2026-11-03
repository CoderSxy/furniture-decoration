import { loadEnv, type Env } from '../src/env.ts'
import type { AppDeps, MysqlPort, RedisPort, WechatPort } from '../src/db/ports.ts'

export function baseEnv(patch: Partial<Env> = {}): Env {
  return {
    ...loadEnv({
      WECHAT_APPID: 'wx678305a130615b19',
      WECHAT_APPSECRET: 'x'.repeat(32),
      MYSQL_HOST: '127.0.0.1',
      MYSQL_USER: 'fd',
      MYSQL_PASSWORD: 'secret',
      MYSQL_DATABASE: 'furniture',
      REDIS_HOST: '127.0.0.1',
      REDIS_PASSWORD: 'redis-secret',
      SESSION_SECRET: 's'.repeat(32),
      NODE_ENV: 'development',
    }),
    ...patch,
  }
}

export function memoryMysql(): MysqlPort {
  return {
    async upsertUserByOpenid() {
      throw new Error('mysql not used in task 1')
    },
    async listSyncItems() {
      return []
    },
    async getSyncItem() {
      return null
    },
    async upsertSyncItem() {},
    async withTransaction(fn) {
      return fn(this)
    },
  }
}

export function memoryRedis(): RedisPort {
  const store = new Map<string, { value: string; exp: number }>()
  const now = () => Date.now()
  const live = (key: string) => {
    const row = store.get(key)
    if (!row) return null
    if (row.exp !== 0 && row.exp < now()) {
      store.delete(key)
      return null
    }
    return row
  }
  return {
    async get(key) {
      return live(key)?.value ?? null
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value, exp: ttlSeconds > 0 ? now() + ttlSeconds * 1000 : 0 })
    },
    async del(key) {
      store.delete(key)
    },
    async expire(key, ttlSeconds) {
      const row = live(key)
      if (row) store.set(key, { value: row.value, exp: now() + ttlSeconds * 1000 })
    },
    async incr(key) {
      const current = Number(live(key)?.value ?? '0')
      const next = current + 1
      const exp = live(key)?.exp ?? now() + 60_000
      store.set(key, { value: String(next), exp })
      return next
    },
  }
}

export function testDeps(patch: { env?: Partial<Env> } = {}): AppDeps {
  return {
    env: baseEnv(patch.env),
    mysql: memoryMysql(),
    redis: memoryRedis(),
    wechat: {
      async code2Session() {
        return { errcode: -1 }
      },
    } satisfies WechatPort,
    clock: () => new Date('2026-11-03T12:00:00.000Z'),
    randomBytes: (size) => Buffer.alloc(size, 7),
    uuid: () => '11111111-1111-4111-8111-111111111111',
  }
}

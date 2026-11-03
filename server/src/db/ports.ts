import type { Env } from '../env.ts'
import type { SyncItem } from '../types/sync.ts'

export type UserRow = {
  id: string
  openid: string
  created_at: Date
  updated_at: Date
  last_login_at: Date
}

export type SyncItemRow = {
  user_id: string
  kind: SyncItem['kind']
  item_id: string
  payload: unknown | null
  updated_at: Date
  deleted: 0 | 1
  created_at: Date
}

export type MysqlPort = {
  upsertUserByOpenid(openid: string, now: Date, id: string): Promise<UserRow>
  listSyncItems(userId: string): Promise<SyncItemRow[]>
  getSyncItem(userId: string, kind: string, itemId: string): Promise<SyncItemRow | null>
  upsertSyncItem(row: SyncItemRow): Promise<void>
  withTransaction<T>(fn: (tx: MysqlPort) => Promise<T>): Promise<T>
}

export type RedisPort = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  expire(key: string, ttlSeconds: number): Promise<void>
  incr(key: string): Promise<number>
}

export type WechatPort = {
  code2Session(code: string): Promise<{ openid: string } | { errcode: number; httpStatus?: number }>
}

export type AppDeps = {
  env: Env
  mysql: MysqlPort
  redis: RedisPort
  wechat: WechatPort
  clock: () => Date
  randomBytes: (size: number) => Buffer
  uuid: () => string
}

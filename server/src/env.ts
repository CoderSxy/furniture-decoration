export type Env = {
  WECHAT_APPID: string
  WECHAT_APPSECRET: string
  MYSQL_HOST: string
  MYSQL_PORT: number
  MYSQL_USER: string
  MYSQL_PASSWORD: string
  MYSQL_DATABASE: string
  REDIS_HOST: string
  REDIS_PORT: number
  REDIS_PASSWORD: string
  REDIS_DB: number
  SESSION_SECRET: string
  PORT: number
  NODE_ENV: 'production' | 'development'
}

function required(source: NodeJS.Dict<string | undefined>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('missing env')
  }
  return value
}

function optionalInt(source: NodeJS.Dict<string | undefined>, key: string, fallback: number): number {
  const raw = source[key]
  if (raw == null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('missing env')
  return parsed
}

export function loadEnv(source: NodeJS.Dict<string | undefined>): Env {
  const nodeEnv = source.NODE_ENV === 'development' ? 'development' : 'production'
  const redisPassword = source.REDIS_PASSWORD ?? ''
  if (nodeEnv === 'production' && redisPassword.length === 0) {
    throw new Error('missing env')
  }
  const sessionSecret = required(source, 'SESSION_SECRET')
  if (sessionSecret.length < 32) throw new Error('missing env')
  return {
    WECHAT_APPID: required(source, 'WECHAT_APPID'),
    WECHAT_APPSECRET: required(source, 'WECHAT_APPSECRET'),
    MYSQL_HOST: required(source, 'MYSQL_HOST'),
    MYSQL_PORT: optionalInt(source, 'MYSQL_PORT', 3306),
    MYSQL_USER: required(source, 'MYSQL_USER'),
    MYSQL_PASSWORD: required(source, 'MYSQL_PASSWORD'),
    MYSQL_DATABASE: required(source, 'MYSQL_DATABASE'),
    REDIS_HOST: required(source, 'REDIS_HOST'),
    REDIS_PORT: optionalInt(source, 'REDIS_PORT', 6379),
    REDIS_PASSWORD: redisPassword,
    REDIS_DB: source.REDIS_DB == null || source.REDIS_DB === '' ? 0 : optionalInt(source, 'REDIS_DB', 0),
    SESSION_SECRET: sessionSecret,
    PORT: optionalInt(source, 'PORT', 3000),
    NODE_ENV: nodeEnv,
  }
}

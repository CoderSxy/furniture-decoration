import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEnv } from '../src/env.ts'

const VALID = {
  WECHAT_APPID: 'wx678305a130615b19',
  WECHAT_APPSECRET: 'x'.repeat(32),
  MYSQL_HOST: '127.0.0.1',
  MYSQL_USER: 'fd',
  MYSQL_PASSWORD: 'secret',
  MYSQL_DATABASE: 'furniture',
  REDIS_HOST: '127.0.0.1',
  REDIS_PASSWORD: 'redis-secret',
  SESSION_SECRET: 's'.repeat(32),
  NODE_ENV: 'production',
}

test('loadEnv fills MYSQL_PORT REDIS_PORT REDIS_DB PORT defaults', () => {
  const env = loadEnv(VALID)
  assert.equal(env.MYSQL_PORT, 3306)
  assert.equal(env.REDIS_PORT, 6379)
  assert.equal(env.REDIS_DB, 0)
  assert.equal(env.PORT, 3000)
  assert.equal(env.WECHAT_APPID, 'wx678305a130615b19')
})

test('loadEnv throws missing env when required secrets are absent', () => {
  for (const key of [
    'WECHAT_APPID',
    'WECHAT_APPSECRET',
    'MYSQL_HOST',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'REDIS_HOST',
    'SESSION_SECRET',
  ]) {
    const source = { ...VALID }
    delete source[key as keyof typeof source]
    assert.throws(() => loadEnv(source), /missing env/)
  }
})

test('production rejects empty REDIS_PASSWORD; development allows empty string', () => {
  assert.throws(() => loadEnv({ ...VALID, REDIS_PASSWORD: '' }), /missing env/)
  const dev = loadEnv({ ...VALID, NODE_ENV: 'development', REDIS_PASSWORD: '' })
  assert.equal(dev.REDIS_PASSWORD, '')
})

test('SESSION_SECRET shorter than 32 characters is missing env', () => {
  assert.throws(() => loadEnv({ ...VALID, SESSION_SECRET: 'too-short' }), /missing env/)
})

test('loadEnv error message must not include secret values', () => {
  try {
    loadEnv({ ...VALID, WECHAT_APPSECRET: '' })
    assert.fail('expected throw')
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    assert.match(text, /missing env/)
    assert.equal(text.includes('x'.repeat(32)), false)
    assert.equal(text.includes(VALID.MYSQL_PASSWORD), false)
  }
})

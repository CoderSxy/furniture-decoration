import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { SESSION_TTL_SECONDS, createSessionToken, encodeSid, sessionKey } from '../src/services/session.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

test('sync and logout require a live HMAC+Redis session', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-a' } } }
  const { url, close } = await listen(createApp(deps))
  try {
    const missing = await fetch(`${url}/api/sync`)
    assert.equal(missing.status, 401)
    assert.equal((await missing.json()).error.message, '请重新登录')

    const bad = await fetch(`${url}/api/sync`, { headers: { authorization: 'Bearer not-a-token' } })
    assert.equal(bad.status, 401)

    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    const ok = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.notEqual(ok.status, 401)

    const sid = encodeSid(Buffer.alloc(32, 7))
    await deps.redis.del(sessionKey(sid))
    const miss = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(miss.status, 401)

    const forged = createSessionToken('u'.repeat(32), sid)
    const hmacFail = await fetch(`${url}/api/sync`, {
      headers: { authorization: `Bearer ${forged}` },
    })
    assert.equal(hmacFail.status, 401)
  } finally {
    await close()
  }
})

test('logout deletes redis session and returns 204', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-b' } } }
  const { url, close } = await listen(createApp(deps))
  try {
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    const sid = encodeSid(Buffer.alloc(32, 7))
    assert.ok(await deps.redis.get(sessionKey(sid)))
    const res = await fetch(`${url}/api/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(res.status, 204)
    assert.equal(await res.text(), '')
    assert.equal(await deps.redis.get(sessionKey(sid)), null)
    const again = await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(again.status, 401)
  } finally {
    await close()
  }
})

test('successful auth refreshes session TTL', async () => {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-c' } } }
  let expireCalls = 0
  const inner = deps.redis.expire.bind(deps.redis)
  deps.redis.expire = async (key, ttl) => {
    expireCalls += 1
    assert.equal(ttl, SESSION_TTL_SECONDS)
    await inner(key, ttl)
  }
  const { url, close } = await listen(createApp(deps))
  try {
    const loginRes = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx' }),
    })
    const { token } = (await loginRes.json()) as { token: string }
    await fetch(`${url}/api/sync`, { headers: { authorization: `Bearer ${token}` } })
    assert.ok(expireCalls >= 1)
  } finally {
    await close()
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { SESSION_TTL_SECONDS, sessionKey, verifySessionToken } from '../src/services/session.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'
import type { AppDeps } from '../src/db/ports.ts'

async function postLogin(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function depsWithWechat(wechat: AppDeps['wechat'], extra: Parameters<typeof testDeps>[0] = {}) {
  const deps = testDeps(extra)
  deps.wechat = wechat
  return deps
}

test('login exchanges code for token without leaking openid', async () => {
  const deps = depsWithWechat({
    async code2Session(code) {
      assert.equal(code, 'wx-one-time')
      return { openid: 'oid-secret' }
    },
  })
  const { url, close } = await listen(createApp(deps))
  try {
    const res = await postLogin(url, { code: 'wx-one-time' })
    assert.equal(res.status, 200)
    const json = (await res.json()) as {
      token: string
      expiresIn: number
      user: { id: string }
    }
    assert.equal(json.expiresIn, SESSION_TTL_SECONDS)
    assert.equal(json.user.id, '11111111-1111-4111-8111-111111111111')
    const raw = JSON.stringify(json)
    assert.equal(raw.includes('oid-secret'), false)
    assert.equal(raw.includes('session_key'), false)
    assert.equal(raw.includes('unionid'), false)
    const sid = verifySessionToken(deps.env.SESSION_SECRET, json.token)
    assert.ok(sid)
    const sess = await deps.redis.get(sessionKey(sid!))
    assert.deepEqual(JSON.parse(sess!), { userId: json.user.id })
  } finally {
    await close()
  }
})

test('missing, empty, oversized, or WeChat 40029/40163 map to INVALID_CODE', async () => {
  for (const [wechat, body] of [
    [
      { async code2Session() { return { errcode: 40029 } } },
      { code: 'used' },
    ],
    [
      { async code2Session() { return { errcode: 40163 } } },
      { code: 'used2' },
    ],
  ] as const) {
    const { url, close } = await listen(createApp(depsWithWechat(wechat)))
    try {
      const res = await postLogin(url, body)
      assert.equal(res.status, 401)
      assert.equal((await res.json()).error.code, 'INVALID_CODE')
    } finally {
      await close()
    }
  }
  const { url, close } = await listen(createApp(testDeps()))
  try {
    for (const body of [{}, { code: '' }, { code: 'a'.repeat(129) }, { code: 1 }]) {
      const res = await postLogin(url, body)
      assert.equal(res.status, 401)
      assert.equal((await res.json()).error.code, 'INVALID_CODE')
    }
  } finally {
    await close()
  }
})

test('WeChat timeout or http 5xx maps to WECHAT_UNAVAILABLE', async () => {
  const { url, close } = await listen(
    createApp(
      depsWithWechat({
        async code2Session() {
          return { errcode: -1, httpStatus: 503 }
        },
      }),
    ),
  )
  try {
    const res = await postLogin(url, { code: 'wx' })
    assert.equal(res.status, 502)
    assert.equal((await res.json()).error.code, 'WECHAT_UNAVAILABLE')
  } finally {
    await close()
  }
})

test('production login succeeds only with X-Forwarded-Proto https', async () => {
  const deps = depsWithWechat(
    { async code2Session() { return { openid: 'oid-https' } } },
    { env: { NODE_ENV: 'production' } },
  )
  const { url, close } = await listen(createApp(deps))
  try {
    const blocked = await postLogin(url, { code: 'wx' })
    assert.equal(blocked.status, 400)
    const ok = await postLogin(url, { code: 'wx' }, { 'x-forwarded-proto': 'https' })
    assert.equal(ok.status, 200)
  } finally {
    await close()
  }
})

test('21st login from the same IP within 60s is RATE_LIMITED', async () => {
  const deps = depsWithWechat({
    async code2Session() {
      return { openid: 'oid-rl' }
    },
  })
  const { url, close } = await listen(createApp(deps))
  try {
    for (let i = 0; i < 20; i += 1) {
      const res = await postLogin(url, { code: `c${i}` }, { 'x-forwarded-for': '203.0.113.9' })
      assert.equal(res.status, 200)
    }
    const blocked = await postLogin(url, { code: 'c21' }, { 'x-forwarded-for': '203.0.113.9' })
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED')
  } finally {
    await close()
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

test('GET /api/health returns { ok: true } without Authorization', async () => {
  const { url, close } = await listen(createApp(testDeps()))
  try {
    const res = await fetch(`${url}/api/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
  } finally {
    await close()
  }
})

test('production non-health requests without X-Forwarded-Proto https return 400', async () => {
  const deps = testDeps({ env: { NODE_ENV: 'production' } })
  const { url, close } = await listen(createApp(deps))
  try {
    const health = await fetch(`${url}/api/health`)
    assert.equal(health.status, 200)
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wx-code' }),
    })
    assert.equal(res.status, 400)
    const body = await res.json()
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  } finally {
    await close()
  }
})

test('development allows http for health', async () => {
  const deps = testDeps({ env: { NODE_ENV: 'development' } })
  const { url, close } = await listen(createApp(deps))
  try {
    const res = await fetch(`${url}/api/health`)
    assert.equal(res.status, 200)
  } finally {
    await close()
  }
})

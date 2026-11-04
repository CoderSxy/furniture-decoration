import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

async function authed(url: string, token: string, method: 'GET' | 'PUT', body?: unknown) {
  return fetch(`${url}/api/sync`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function start() {
  const deps = testDeps()
  deps.wechat = { async code2Session() { return { openid: 'oid-sync' } } }
  const started = await listen(createApp(deps))
  const login = await fetch(`${started.url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'wx' }),
  })
  const { token, user } = (await login.json()) as { token: string; user: { id: string } }
  return { ...started, token, user, deps }
}

const planPayload = {
  id: 'plan-abc',
  title: '客厅',
  roomType: 'living',
  areaM2: 20,
  stage: 'measure',
  productIds: [],
  createdAt: '2026-11-03T11:00:00.000Z',
  updatedAt: '2026-11-03T12:00:00.000Z',
}

test('empty GET then PUT insert, equal timestamp keeps server, later overwrites', async () => {
  const { url, close, token } = await start()
  try {
    const empty = await authed(url, token, 'GET')
    assert.equal(empty.status, 200)
    const emptyBody = await empty.json()
    assert.equal(emptyBody.serverTime, '2026-11-03T12:00:00.000Z')
    assert.deepEqual(emptyBody.items, [])

    const first = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: planPayload,
        },
      ],
    })
    assert.equal(first.status, 200)
    assert.equal((await first.json()).items[0].payload.title, '客厅')

    const stale = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.200Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: { ...planPayload, title: '旧标题会被丢掉' },
        },
      ],
    })
    assert.equal((await stale.json()).items[0].payload.title, '客厅')

    const newer = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.300Z',
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:05.000Z',
          deleted: false,
          payload: { ...planPayload, title: '设备B', stage: 'design', updatedAt: '2026-11-03T12:00:05.000Z' },
        },
      ],
    })
    const merged = await newer.json()
    assert.equal(merged.items[0].payload.title, '设备B')
    assert.equal(merged.items[0].payload.stage, 'design')
  } finally {
    await close()
  }
})

test('scan photoPaths are stored as [] and tombstones do not resurrect', async () => {
  const { url, close, token } = await start()
  try {
    await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [
        {
          kind: 'scan',
          itemId: 'plan-abc',
          updatedAt: '2026-11-03T12:00:00.000Z',
          deleted: false,
          payload: {
            planId: 'plan-abc',
            source: 'manual',
            widthMm: 4000,
            depthMm: 3000,
            heightMm: 2800,
            photoPaths: ['tmp://secret.jpg'],
            capturedAt: '2026-11-03T11:00:00.000Z',
            updatedAt: '2026-11-03T12:00:00.000Z',
          },
        },
      ],
    })
    const got = await (await authed(url, token, 'GET')).json()
    const scan = got.items.find((row: { kind: string }) => row.kind === 'scan')
    assert.deepEqual(scan.payload.photoPaths, [])

    await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.200Z',
      items: [
        {
          kind: 'favorite',
          itemId: 'p-sofa-modern-01',
          updatedAt: '2026-11-03T12:00:10.000Z',
          deleted: true,
          payload: null,
        },
      ],
    })
    const after = await (await authed(url, token, 'GET')).json()
    const fav = after.items.find((row: { itemId: string }) => row.itemId === 'p-sofa-modern-01')
    assert.equal(fav.deleted, true)
    assert.equal(fav.payload, null)
  } finally {
    await close()
  }
})

test('validation rejects deleted+payload, unknown kind, and too many favorites', async () => {
  const { url, close, token } = await start()
  try {
    const badDeleted = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [{ kind: 'plan', itemId: 'x', updatedAt: '2026-11-03T12:00:00.000Z', deleted: true, payload: { id: 'x' } }],
    })
    assert.equal(badDeleted.status, 400)
    assert.equal((await badDeleted.json()).error.code, 'VALIDATION_ERROR')

    const badKind = await authed(url, token, 'PUT', {
      clientTime: '2026-11-03T12:00:00.100Z',
      items: [{ kind: 'note', itemId: 'x', updatedAt: '2026-11-03T12:00:00.000Z', deleted: false, payload: {} }],
    })
    assert.equal(badKind.status, 400)

    const items = Array.from({ length: 201 }, (_, i) => ({
      kind: 'favorite',
      itemId: `p-${i}`,
      updatedAt: '2026-11-03T12:00:00.000Z',
      deleted: false,
      payload: { productId: `p-${i}`, savedAt: '2026-11-03T12:00:00.000Z', updatedAt: '2026-11-03T12:00:00.000Z' },
    }))
    const tooMany = await authed(url, token, 'PUT', { clientTime: '2026-11-03T12:00:00.100Z', items })
    assert.equal(tooMany.status, 400)
  } finally {
    await close()
  }
})

test('PUT body larger than 512 KiB is PAYLOAD_TOO_LARGE', async () => {
  const { url, close, token } = await start()
  try {
    const huge = 'x'.repeat(513 * 1024)
    const res = await fetch(`${url}/api/sync`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientTime: '2026-11-03T12:00:00.100Z', items: [], pad: huge }),
    })
    assert.equal(res.status, 413)
    assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE')
  } finally {
    await close()
  }
})

test('session validation requires a live Bearer', async () => {
  const { url, close, token } = await start()
  try {
    const valid = await fetch(`${url}/api/auth/session`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(valid.status, 200)
    assert.ok((await valid.json()).user.id)
    await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
    assert.equal((await fetch(`${url}/api/auth/session`, { headers: { authorization: `Bearer ${token}` } })).status, 401)
  } finally { await close() }
})

test('full clear removes unseen cloud records for only the authenticated user', async () => {
  const { url, close, token, deps, user } = await start()
  try {
    const row = { kind: 'favorite' as const, item_id: 'unseen', payload: { productId: 'unseen' }, updated_at: deps.clock(), created_at: deps.clock(), deleted: 0 as const }
    await deps.mysql.upsertSyncItem({ ...row, user_id: user.id })
    await deps.mysql.upsertSyncItem({ ...row, user_id: 'other-user' })
    const result = await fetch(`${url}/api/sync`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })
    assert.equal(result.status, 200)
    assert.deepEqual((await result.json()).items, [])
    assert.deepEqual(await deps.mysql.listSyncItems(user.id), [])
    assert.equal((await deps.mysql.listSyncItems('other-user')).length, 1)
    assert.equal((await fetch(`${url}/api/sync`, { method: 'DELETE' })).status, 401)
  } finally { await close() }
})

test('future outer timestamp is clamped into payload as well', async () => {
  const { url, close, token } = await start()
  try {
    const result = await authed(url, token, 'PUT', { items: [{ kind: 'plan', itemId: 'plan-abc', updatedAt: '2099-01-01T00:00:00.000Z', deleted: false, payload: { ...planPayload, updatedAt: '2099-01-01T00:00:00.000Z' } }] })
    const item = (await result.json()).items[0]
    assert.equal(item.updatedAt, '2026-11-03T12:00:00.000Z')
    assert.equal(item.payload.updatedAt, item.updatedAt)
  } finally { await close() }
})

test('concurrent older PUT finishing last cannot replace a newer tombstone', async () => {
  const { url, close, token, deps } = await start()
  const original = deps.mysql.upsertSyncItem.bind(deps.mysql)
  let releaseOld!: () => void
  const newerWritten = new Promise<void>(resolve => { releaseOld = resolve })
  deps.mysql.upsertSyncItem = async row => {
    if (row.updated_at.toISOString() === '2026-11-03T12:00:00.000Z') await newerWritten
    await original(row)
    if (row.deleted) releaseOld()
  }
  try {
    const old = authed(url, token, 'PUT', { items: [{ kind: 'plan', itemId: 'plan-abc', updatedAt: '2026-11-03T12:00:00.000Z', deleted: false, payload: planPayload }] })
    const newer = authed(url, token, 'PUT', { items: [{ kind: 'plan', itemId: 'plan-abc', updatedAt: '2026-11-03T12:00:05.000Z', deleted: true, payload: null }] })
    const results = await Promise.all([old, newer])
    assert.deepEqual(results.map(r => r.status), [200, 200])
    const item = (await (await authed(url, token, 'GET')).json()).items[0]
    assert.equal(item.deleted, true)
    assert.equal(item.updatedAt, '2026-11-03T12:00:05.000Z')
  } finally { await close() }
})

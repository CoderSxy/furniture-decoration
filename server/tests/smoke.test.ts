import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'
import type { SyncItem } from '../src/types/sync.ts'
import { testDeps } from './fakes.ts'
import { listen } from './helpers.ts'

const T0 = '2026-11-03T12:00:00.000Z'
const T1 = '2026-11-03T12:00:05.000Z'
const T2 = '2026-11-03T12:00:10.000Z'

const planA = {
  id: 'plan-abc',
  title: '客厅A',
  roomType: 'living',
  areaM2: 20,
  stage: 'measure',
  productIds: [] as string[],
  createdAt: T0,
  updatedAt: T0,
}

const itemsA: SyncItem[] = [
  {
    kind: 'favorite',
    itemId: 'p-sofa-modern-01',
    updatedAt: T0,
    deleted: false,
    payload: { productId: 'p-sofa-modern-01', savedAt: T0, updatedAt: T0 },
  },
  {
    kind: 'plan',
    itemId: 'plan-abc',
    updatedAt: T0,
    deleted: false,
    payload: planA,
  },
  {
    kind: 'preference',
    itemId: 'activePlanId',
    updatedAt: T0,
    deleted: false,
    payload: { activePlanId: 'plan-abc' },
  },
  {
    kind: 'budget',
    itemId: 'plan-abc',
    updatedAt: T0,
    deleted: false,
    payload: {
      planId: 'plan-abc',
      totalFen: 1600000,
      spentByCategory: { furniture: 0, material: 560000, labor: 400000, other: 640000 },
      updatedAt: T0,
    },
  },
  {
    kind: 'scan',
    itemId: 'plan-abc',
    updatedAt: T0,
    deleted: false,
    payload: {
      planId: 'plan-abc',
      source: 'manual',
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2800,
      photoPaths: ['tmp://secret.jpg'],
      capturedAt: T0,
      updatedAt: T0,
    },
  },
  {
    kind: 'aiPreview',
    itemId: 'plan-abc',
    updatedAt: T0,
    deleted: false,
    payload: {
      planId: 'plan-abc',
      request: {
        planId: 'plan-abc',
        roomType: 'living',
        areaM2: 20,
        style: 'modern',
        budgetFen: 1600000,
        existingProductIds: [],
      },
      items: [{ productId: 'p-sofa-modern-01', score: 0.9, reason: 'ok' }],
      updatedAt: T0,
    },
  },
]

function byKind(items: SyncItem[]): Map<string, SyncItem> {
  return new Map(items.map((row) => [`${row.kind}:${row.itemId}`, row]))
}

test('login PUT six kinds, second client GET matches, later updatedAt wins, tombstone stays dead, missing token 401', async () => {
  const deps = testDeps()
  let nonce = 1
  deps.randomBytes = (size) => Buffer.alloc(size, nonce++)
  deps.wechat = { async code2Session() { return { openid: 'oid-smoke' } } }
  const { url, close } = await listen(createApp(deps))

  async function login(code: string) {
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    assert.equal(res.status, 200)
    return (await res.json()) as { token: string; user: { id: string } }
  }

  async function sync(token: string, method: 'GET' | 'PUT', body?: unknown) {
    return fetch(`${url}/api/sync`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  try {
    const deviceA = await login('code-a')
    const deviceB = await login('code-b')
    assert.equal(deviceA.user.id, deviceB.user.id)
    assert.notEqual(deviceA.token, deviceB.token)

    const putA = await sync(deviceA.token, 'PUT', { clientTime: T0, items: itemsA })
    assert.equal(putA.status, 200)

    const getB = await (await sync(deviceB.token, 'GET')).json() as { items: SyncItem[] }
    const mapB = byKind(getB.items)
    assert.equal(mapB.size, 6)
    for (const kind of ['favorite', 'plan', 'preference', 'budget', 'scan', 'aiPreview']) {
      assert.ok(mapB.has(`${kind}:${kind === 'preference' ? 'activePlanId' : kind === 'favorite' ? 'p-sofa-modern-01' : 'plan-abc'}`))
    }
    assert.deepEqual((mapB.get('scan:plan-abc')?.payload as { photoPaths: string[] }).photoPaths, [])
    assert.equal((mapB.get('plan:plan-abc')?.payload as { title: string }).title, '客厅A')
    assert.equal((mapB.get('favorite:p-sofa-modern-01')?.deleted), false)

    const putB = await sync(deviceB.token, 'PUT', {
      clientTime: T1,
      items: [
        {
          kind: 'plan',
          itemId: 'plan-abc',
          updatedAt: T1,
          deleted: false,
          payload: { ...planA, title: '设备B', stage: 'design', updatedAt: T1 },
        },
      ],
    })
    assert.equal(putB.status, 200)
    const afterConflict = byKind(((await putB.json()) as { items: SyncItem[] }).items)
    const mergedPlan = afterConflict.get('plan:plan-abc')?.payload as { title: string; stage: string }
    assert.equal(mergedPlan.title, '设备B')
    assert.equal(mergedPlan.stage, 'design')

    const tomb = await sync(deviceB.token, 'PUT', {
      clientTime: T2,
      items: [
        {
          kind: 'favorite',
          itemId: 'p-sofa-modern-01',
          updatedAt: T2,
          deleted: true,
          payload: null,
        },
      ],
    })
    assert.equal(tomb.status, 200)

    const getA = await (await sync(deviceA.token, 'GET')).json() as { items: SyncItem[] }
    const mapA = byKind(getA.items)
    const fav = mapA.get('favorite:p-sofa-modern-01')
    assert.equal(fav?.deleted, true)
    assert.equal(fav?.payload, null)
    const planAgain = mapA.get('plan:plan-abc')?.payload as { title: string; stage: string }
    assert.equal(planAgain.title, '设备B')
    assert.equal(planAgain.stage, 'design')

    const anonymous = await fetch(`${url}/api/sync`)
    assert.equal(anonymous.status, 401)
  } finally {
    await close()
  }
})

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import Taro from '@tarojs/taro'
import { PRODUCTS } from '../src/mocks/products.ts'
import { useAiPreviewStore } from '../src/stores/aiPreviewStore.ts'
import { useBudgetStore } from '../src/stores/budgetStore.ts'
import { useFavoriteStore } from '../src/stores/favoriteStore.ts'
import { usePlanStore } from '../src/stores/planStore.ts'
import { useScanStore } from '../src/stores/scanStore.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import {
  applySyncItems,
  collectSyncItems,
  runLoginSync,
  schedulePush,
} from '../src/utils/syncEngine.ts'
import { configureStorage, createMemoryStorage } from '../src/utils/storage.ts'
import { listTombstones, recordTombstone } from '../src/utils/tombstones.ts'
import type { SyncItem } from '../src/types/sync.ts'

describe('syncEngine', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useFavoriteStore.setState({ items: [] })
    usePlanStore.setState({ plans: [], activePlanId: null, activePlanUpdatedAt: null })
    useBudgetStore.setState({ budgets: {} })
    useScanStore.setState({ scans: {} })
    useAiPreviewStore.setState({ previews: {} })
    useSyncStore.setState({ verified: true, token: 'sid.sig', userId: 'user-1', loggedInAt: '2026-11-03T12:00:00.000Z', pendingRetry: false })
    process.env.TARO_APP_API_BASE_URL = 'https://example.com'
  })

  afterEach(() => {
    delete process.env.TARO_APP_API_BASE_URL
    mock.timers.reset()
  })

  it('collectSyncItems includes every kind and strips scan photoPaths', () => {
    useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
    const created = usePlanStore.getState().createPlan({ title: '客厅', roomType: 'living', areaM2: 20 })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('plan')
    useBudgetStore.getState().ensureForPlan(created.plan, PRODUCTS)
    useScanStore.getState().upsert({
      planId: created.plan.id,
      source: 'manual',
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2800,
      photoPaths: ['tmp://secret.jpg'],
      capturedAt: '2026-11-03T11:00:00.000Z',
      updatedAt: '2026-11-03T11:00:00.000Z',
    })
    useAiPreviewStore.getState().upsert(created.plan.id, {
      planId: created.plan.id,
      roomType: 'living',
      areaM2: 20,
      style: 'modern',
      budgetFen: 1600000,
      existingProductIds: [],
    }, [])
    recordTombstone('favorite', 'p-old', '2026-11-03T12:00:00.000Z')
    const items = collectSyncItems()
    const kinds = new Set(items.map((row) => row.kind))
    assert.ok(kinds.has('favorite'))
    assert.ok(kinds.has('plan'))
    assert.ok(kinds.has('preference'))
    assert.ok(kinds.has('budget'))
    assert.ok(kinds.has('scan'))
    assert.ok(kinds.has('aiPreview'))
    const scan = items.find((row) => row.kind === 'scan')
    assert.deepEqual((scan?.payload as { photoPaths: string[] }).photoPaths, [])
    assert.ok(items.some((row) => row.deleted && row.itemId === 'p-old'))
  })

  it('applySyncItems writes a remote plan into planStore', () => {
    applySyncItems([
      {
        kind: 'plan',
        itemId: 'plan-remote',
        updatedAt: '2026-11-03T12:00:00.000Z',
        deleted: false,
        payload: {
          id: 'plan-remote',
          title: '云端客厅',
          roomType: 'living',
          areaM2: 22,
          stage: 'measure',
          productIds: [],
          createdAt: '2026-11-03T11:00:00.000Z',
          updatedAt: '2026-11-03T12:00:00.000Z',
        },
      },
    ])
    assert.equal(usePlanStore.getState().plans[0].title, '云端客厅')
  })

  it('two rapid schedulePush calls emit a single PUT after 800ms', async () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    const methods: string[] = []
    Taro.request = async (options) => {
      methods.push(String(options.method))
      return { statusCode: 200, data: { serverTime: '2026-11-03T12:00:00.000Z', items: [] } }
    }
    schedulePush()
    schedulePush()
    mock.timers.tick(800)
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(methods.filter((method) => method === 'PUT').length, 1)
  })

  it('runLoginSync GETs then PUTs; GET timeout sets pendingRetry', async () => {
    const methods: string[] = []
    Taro.request = async (options) => {
      methods.push(String(options.method))
      return { statusCode: 200, data: { serverTime: '2026-11-03T12:00:00.000Z', items: [] } }
    }
    await runLoginSync()
    assert.deepEqual(methods, ['GET', 'PUT'])

    mock.timers.enable({ apis: ['setTimeout'] })
    Taro.request = () => new Promise(() => {})
    const pending = runLoginSync()
    mock.timers.tick(8000)
    await pending
    assert.equal(useSyncStore.getState().pendingRetry, true)
  })

  it('a different userId resets local business data before GET', async () => {
    useFavoriteStore.getState().toggleFavorite('p-sofa-modern-01')
    Taro.request = async () => ({ statusCode: 200, data: { serverTime: '2026-11-03T12:00:00.000Z', items: [] } })
    await runLoginSync('other-user')
    assert.deepEqual(useFavoriteStore.getState().items, [])
  })

  it('preference pointing at a deleted plan falls back to the newest remaining plan', () => {
    applySyncItems([
      {
        kind: 'plan',
        itemId: 'plan-keep',
        updatedAt: '2026-11-03T12:00:05.000Z',
        deleted: false,
        payload: {
          id: 'plan-keep',
          title: '留着',
          roomType: 'living',
          areaM2: 20,
          stage: 'measure',
          productIds: [],
          createdAt: '2026-11-03T11:00:00.000Z',
          updatedAt: '2026-11-03T12:00:05.000Z',
        },
      },
      {
        kind: 'plan',
        itemId: 'plan-gone',
        updatedAt: '2026-11-03T12:00:10.000Z',
        deleted: true,
        payload: null,
      },
      {
        kind: 'preference',
        itemId: 'activePlanId',
        updatedAt: '2026-11-03T12:00:10.000Z',
        deleted: false,
        payload: { activePlanId: 'plan-gone' },
      },
    ])
    assert.equal(usePlanStore.getState().activePlanId, 'plan-keep')
  })
})

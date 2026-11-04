import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { SCANS_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  getByPlanId,
  parsePersistedScans,
  selectScanByPlanId,
  useScanStore,
} from '../src/stores/scanStore.ts'
import type { RoomScan } from '../src/types/domain.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

const validScan: RoomScan = {
  planId: 'plan-living',
  source: 'manual',
  widthMm: 4000,
  depthMm: 3000,
  heightMm: 2800,
  photoPaths: ['tmp://a.jpg'],
  capturedAt: '2026-11-03T08:00:00.000Z',
  updatedAt: '2026-11-03T08:00:00.000Z',
}

describe('scanStore', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useScanStore.setState({ scans: {} })
  })

  it('parsePersistedScans drops malformed rows', () => {
    assert.deepEqual(parsePersistedScans(null), {})
    assert.deepEqual(parsePersistedScans([]), {})
    const parsed = parsePersistedScans({
      'plan-living': validScan,
      'plan-bad': { ...validScan, planId: 'nope' },
      'plan-source': { ...validScan, planId: 'plan-source', source: 'lidar' },
    })
    assert.deepEqual(Object.keys(parsed), ['plan-living'])
  })

  it('hydrate restores fd:scans and reset clears it', () => {
    configureStorage(
      createMemoryStorage({
        [SCANS_STORAGE_KEY]: JSON.stringify({ 'plan-living': validScan }),
      }),
    )
    useScanStore.getState().hydrate()
    assert.deepEqual(useScanStore.getState().scans, { 'plan-living': validScan })
    useScanStore.getState().reset()
    assert.deepEqual(useScanStore.getState().scans, {})
    assert.deepEqual(readJSON(SCANS_STORAGE_KEY, { keep: true }), {})
  })

  it('upsert overwrites the same planId and keeps other plans', () => {
    useScanStore.getState().upsert(validScan)
    const first = getByPlanId('plan-living')
    assert.equal(first?.planId, 'plan-living')
    assert.equal(first?.widthMm, 4000)
    assert.match(first?.updatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/)
    assert.deepEqual(selectScanByPlanId(useScanStore.getState(), 'plan-living'), first)
    assert.equal(selectScanByPlanId(useScanStore.getState(), 'missing'), undefined)

    const other: RoomScan = {
      ...validScan,
      planId: 'plan-bed',
      source: 'visionkit-v2',
      photoPaths: [],
      widthMm: 3600,
    }
    useScanStore.getState().upsert(other)

    const replaced: RoomScan = {
      ...validScan,
      widthMm: 4100,
      capturedAt: '2026-11-03T09:00:00.000Z',
    }
    useScanStore.getState().upsert(replaced)

    assert.equal(useScanStore.getState().scans['plan-living'].widthMm, 4100)
    assert.equal(useScanStore.getState().scans['plan-bed'].planId, 'plan-bed')
    assert.match(useScanStore.getState().scans['plan-living'].updatedAt, /^\d{4}-\d{2}-\d{2}T/)
  })

  it('hydrate backfills updatedAt from capturedAt', () => {
    configureStorage(
      createMemoryStorage({
        [SCANS_STORAGE_KEY]: JSON.stringify({
          'plan-living': {
            planId: 'plan-living',
            source: 'manual',
            widthMm: 4000,
            depthMm: 3000,
            heightMm: 2800,
            photoPaths: [],
            capturedAt: '2026-11-03T08:00:00.000Z',
          },
        }),
      }),
    )
    useScanStore.getState().hydrate()
    assert.equal(useScanStore.getState().scans['plan-living'].updatedAt, '2026-11-03T08:00:00.000Z')
  })
})

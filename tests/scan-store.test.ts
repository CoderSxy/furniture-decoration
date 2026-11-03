// tests/scan-store.test.ts
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { SCANS_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import { parsePersistedScans, useScanStore } from '../src/stores/scanStore.ts'
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
})

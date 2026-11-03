import assert from 'node:assert/strict'
import test from 'node:test'
import type { SyncItem, SyncKind } from '../src/types/sync.ts'

test('SyncKind union matches the design', () => {
  const kinds: SyncKind[] = ['favorite', 'plan', 'budget', 'scan', 'aiPreview', 'preference']
  const item: SyncItem = {
    kind: 'preference',
    itemId: 'activePlanId',
    updatedAt: '2026-11-03T12:00:00.000Z',
    deleted: false,
    payload: { activePlanId: null },
  }
  assert.equal(kinds.length, 6)
  assert.equal(item.itemId, 'activePlanId')
})

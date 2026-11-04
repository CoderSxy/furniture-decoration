import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeByUpdatedAt } from '../src/utils/syncMerge.ts'
import type { SyncItem } from '../src/types/sync.ts'

const local: SyncItem = {
  kind: 'plan',
  itemId: 'plan-1',
  updatedAt: '2026-11-03T12:00:00.000Z',
  deleted: false,
  payload: { title: 'A' },
}
const remoteNewer: SyncItem = { ...local, updatedAt: '2026-11-03T12:00:05.000Z', payload: { title: 'B', stage: 'design' } }
const remoteEqual: SyncItem = { ...local, payload: { title: 'server' } }

test('newer remote replaces the whole item; equal keeps remote; local-only is kept', () => {
  assert.equal((mergeByUpdatedAt([local], [remoteNewer])[0].payload as { title: string }).title, 'B')
  assert.equal((mergeByUpdatedAt([local], [remoteEqual])[0].payload as { title: string }).title, 'server')
  const extra: SyncItem = { ...local, itemId: 'plan-2', payload: { title: 'only-local' } }
  const merged = mergeByUpdatedAt([local, extra], [remoteNewer])
  assert.ok(merged.some((row) => row.itemId === 'plan-2'))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { clampUpdatedAt, shouldTakeIncoming } from '../src/services/merge.ts'

const T1 = new Date('2026-11-03T12:00:00.000Z')
const T2 = new Date('2026-11-03T12:00:01.000Z')
const NOW = new Date('2026-11-03T12:00:00.000Z')

test('incoming wins only when strictly later; equal keeps server', () => {
  assert.equal(shouldTakeIncoming(T1, null), true)
  assert.equal(shouldTakeIncoming(T2, T1), true)
  assert.equal(shouldTakeIncoming(T1, T2), false)
  assert.equal(shouldTakeIncoming(T1, T1), false)
})

test('client clock more than 10 minutes ahead is clamped', () => {
  const fast = new Date('2026-11-03T12:11:00.001Z')
  const clamped = clampUpdatedAt(fast, NOW)
  assert.equal(clamped.toISOString(), NOW.toISOString())
  const ok = new Date('2026-11-03T12:09:00.000Z')
  assert.equal(clampUpdatedAt(ok, NOW).toISOString(), ok.toISOString())
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { fitFloorplanSize } from '../src/utils/floorplan.ts'

test('fitFloorplanSize keeps aspect ratio inside the box', () => {
  assert.deepEqual(fitFloorplanSize(4000, 3000, 400, 300), { width: 400, height: 300 })
  assert.deepEqual(fitFloorplanSize(8000, 2000, 400, 300), { width: 400, height: 100 })
  assert.deepEqual(fitFloorplanSize(0, 3000, 400, 300), { width: 0, height: 0 })
})

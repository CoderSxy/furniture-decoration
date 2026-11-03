import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceBlockedReason,
  canAdvanceStage,
  createPlanId,
  formatPlanArea,
  nextStage,
  resolveCoverProductId,
  validateCreatePlan,
} from '../src/utils/plans.ts'
import type { Plan } from '../src/types/domain.ts'

function plan(patch: Partial<Plan>): Plan {
  return {
    id: 'plan-1',
    title: '客厅方案',
    roomType: 'living',
    areaM2: 32,
    stage: 'measure',
    productIds: [],
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    ...patch,
  }
}

test('validateCreatePlan requires title, room enum, and area > 0', () => {
  assert.equal(
    validateCreatePlan({ title: '主卧', roomType: 'bedroom', areaM2: 18 }),
    'ok',
  )
  assert.equal(validateCreatePlan({ title: '  ', roomType: 'living', areaM2: 20 }), 'invalid-title')
  assert.equal(validateCreatePlan({ title: '', roomType: 'living', areaM2: 20 }), 'invalid-title')
  assert.equal(validateCreatePlan({ title: 'A', roomType: 'all', areaM2: 20 }), 'invalid-room')
  assert.equal(validateCreatePlan({ title: 'A', roomType: 'garage', areaM2: 20 }), 'invalid-room')
  assert.equal(validateCreatePlan({ title: 'A', roomType: 'living', areaM2: 0 }), 'invalid-area')
  assert.equal(validateCreatePlan({ title: 'A', roomType: 'living', areaM2: -1 }), 'invalid-area')
  assert.equal(validateCreatePlan({ title: 'A', roomType: 'living', areaM2: Number.NaN }), 'invalid-area')
})

test('nextStage only moves one step forward', () => {
  assert.equal(nextStage('measure'), 'design')
  assert.equal(nextStage('design'), 'construct')
  assert.equal(nextStage('construct'), 'accept')
  assert.equal(nextStage('accept'), null)
})

test('measure cannot advance without at least one product', () => {
  const empty = plan({ stage: 'measure', productIds: [] })
  assert.equal(canAdvanceStage(empty), false)
  assert.equal(advanceBlockedReason(empty), '请先去选品')

  const ready = plan({ stage: 'measure', productIds: ['p-sofa-modern-01'] })
  assert.equal(canAdvanceStage(ready), true)
  assert.equal(advanceBlockedReason(ready), null)
})

test('later stages do not skip and accept is terminal', () => {
  assert.equal(canAdvanceStage(plan({ stage: 'design', productIds: [] })), true)
  assert.equal(canAdvanceStage(plan({ stage: 'construct', productIds: [] })), true)
  const done = plan({ stage: 'accept', productIds: ['p-1'] })
  assert.equal(canAdvanceStage(done), false)
  assert.equal(advanceBlockedReason(done), '已验收')
})

test('resolveCoverProductId prefers coverProductId then first product', () => {
  assert.equal(resolveCoverProductId(plan({ productIds: [] })), undefined)
  assert.equal(
    resolveCoverProductId(plan({ productIds: ['a', 'b'] })),
    'a',
  )
  assert.equal(
    resolveCoverProductId(plan({ productIds: ['a', 'b'], coverProductId: 'b' })),
    'b',
  )
  assert.equal(
    resolveCoverProductId(plan({ productIds: ['a'], coverProductId: 'gone' })),
    'a',
  )
})

test('formatPlanArea and createPlanId', () => {
  assert.equal(formatPlanArea(32), '32㎡')
  assert.equal(formatPlanArea(12.5), '12.5㎡')
  const left = createPlanId()
  const right = createPlanId()
  assert.match(left, /^plan-/)
  assert.match(right, /^plan-/)
  assert.notEqual(left, right)
})

import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import { PLANS_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import {
  parsePersistedPlans,
  selectActivePlan,
  usePlanStore,
} from '../src/stores/planStore.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'
import type { Plan } from '../src/types/domain.ts'

const NOW = '2026-11-03T08:00:00.000Z'

function samplePlan(patch: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-living',
    title: '客厅翻新',
    roomType: 'living',
    areaM2: 32,
    stage: 'measure',
    productIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

describe('planStore', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    usePlanStore.setState({ plans: [], activePlanId: null, activePlanUpdatedAt: null })
  })

  it('parsePersistedPlans drops malformed rows and dangling activePlanId', () => {
    assert.deepEqual(parsePersistedPlans(null), { plans: [], activePlanId: null, activePlanUpdatedAt: null })
    assert.deepEqual(parsePersistedPlans([]), { plans: [], activePlanId: null, activePlanUpdatedAt: null })
    const parsed = parsePersistedPlans({
      activePlanId: 'missing',
      plans: [
        samplePlan(),
        { id: '', title: 'x', roomType: 'living', areaM2: 1, stage: 'measure', productIds: [], createdAt: NOW, updatedAt: NOW },
        { ...samplePlan({ id: 'plan-bad-stage', stage: 'done' as Plan['stage'] }) },
        { ...samplePlan({ id: 'plan-zero', areaM2: 0 }) },
        {
          ...samplePlan({ id: 'plan-ok', productIds: ['p-1', 2 as unknown as string, 'p-2'] }),
          extra: true,
        },
      ],
    })
    assert.equal(parsed.activePlanId, null)
    assert.equal(parsed.plans.length, 2)
    assert.deepEqual(parsed.plans[0].id, 'plan-living')
    assert.deepEqual(parsed.plans[1].productIds, ['p-1', 'p-2'])
  })

  it('createPlan requires title and area > 0 then becomes active at measure', () => {
    const rejected = usePlanStore.getState().createPlan({
      title: '  ',
      roomType: 'living',
      areaM2: 20,
    })
    assert.equal(rejected.ok, false)
    if (!rejected.ok) assert.equal(rejected.reason, 'invalid-title')

    const zero = usePlanStore.getState().createPlan({
      title: '主卧',
      roomType: 'bedroom',
      areaM2: 0,
    })
    assert.equal(zero.ok, false)
    if (!zero.ok) assert.equal(zero.reason, 'invalid-area')

    const created = usePlanStore.getState().createPlan({
      title: '  主卧  ',
      roomType: 'bedroom',
      areaM2: 18,
    })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('expected ok')
    assert.equal(created.plan.title, '主卧')
    assert.equal(created.plan.roomType, 'bedroom')
    assert.equal(created.plan.areaM2, 18)
    assert.equal(created.plan.stage, 'measure')
    assert.deepEqual(created.plan.productIds, [])
    assert.match(created.plan.createdAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(usePlanStore.getState().activePlanId, created.plan.id)
    assert.equal(selectActivePlan(usePlanStore.getState())?.id, created.plan.id)
    assert.deepEqual(readJSON(PLANS_STORAGE_KEY, { plans: [], activePlanId: null }), {
      plans: usePlanStore.getState().plans,
      activePlanId: created.plan.id,
      activePlanUpdatedAt: usePlanStore.getState().activePlanUpdatedAt,
    })
  })

  it('setActivePlanId switches current without requiring open-detail', () => {
    const first = usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 10 })
    const second = usePlanStore.getState().createPlan({ title: 'B', roomType: 'study', areaM2: 8 })
    assert.equal(first.ok && second.ok, true)
    if (!first.ok || !second.ok) throw new Error('expected two plans')
    assert.equal(usePlanStore.getState().activePlanId, second.plan.id)

    usePlanStore.getState().setActivePlanId(first.plan.id)
    assert.equal(usePlanStore.getState().activePlanId, first.plan.id)
    assert.equal(usePlanStore.getState().plans.length, 2)

    usePlanStore.getState().setActivePlanId('nope')
    assert.equal(usePlanStore.getState().activePlanId, first.plan.id)
  })

  it('addProductToActivePlan dedupes and does not auto-advance stage', () => {
    assert.equal(usePlanStore.getState().addProductToActivePlan('p-1'), 'no-active-plan')
    usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 12 })
    assert.equal(usePlanStore.getState().addProductToActivePlan('p-1'), 'added')
    assert.equal(usePlanStore.getState().addProductToActivePlan('p-1'), 'duplicate')
    assert.equal(usePlanStore.getState().addProductToActivePlan('p-2'), 'added')
    const active = selectActivePlan(usePlanStore.getState())
    assert.deepEqual(active?.productIds, ['p-1', 'p-2'])
    assert.equal(active?.coverProductId, 'p-1')
    assert.equal(active?.stage, 'measure')
  })

  it('addProductToPlan writes the given plan without switching activePlanId', () => {
    const first = usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 12 })
    const second = usePlanStore.getState().createPlan({ title: 'B', roomType: 'study', areaM2: 8 })
    assert.equal(first.ok && second.ok, true)
    if (!first.ok || !second.ok) throw new Error('expected two plans')
    assert.equal(usePlanStore.getState().activePlanId, second.plan.id)

    assert.equal(usePlanStore.getState().addProductToPlan(first.plan.id, 'p-1'), 'added')
    assert.equal(usePlanStore.getState().addProductToPlan(first.plan.id, 'p-1'), 'duplicate')
    assert.equal(usePlanStore.getState().addProductToPlan('missing', 'p-1'), 'no-active-plan')
    assert.equal(usePlanStore.getState().activePlanId, second.plan.id)
    const target = usePlanStore.getState().plans.find((item) => item.id === first.plan.id)
    assert.deepEqual(target?.productIds, ['p-1'])
    assert.equal(target?.coverProductId, 'p-1')
    assert.equal(target?.stage, 'measure')
  })

  it('removeProductFromPlan does not regress stage', () => {
    const created = usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 12 })
    if (!created.ok) throw new Error('expected plan')
    usePlanStore.getState().addProductToActivePlan('p-1')
    usePlanStore.getState().addProductToActivePlan('p-2')
    assert.equal(usePlanStore.getState().advanceStage(created.plan.id), true)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'design')

    usePlanStore.getState().removeProductFromPlan(created.plan.id, 'p-1')
    const after = selectActivePlan(usePlanStore.getState())
    assert.deepEqual(after?.productIds, ['p-2'])
    assert.equal(after?.coverProductId, 'p-2')
    assert.equal(after?.stage, 'design')

    usePlanStore.getState().removeProductFromPlan(created.plan.id, 'p-2')
    const empty = selectActivePlan(usePlanStore.getState())
    assert.deepEqual(empty?.productIds, [])
    assert.equal(empty?.coverProductId, undefined)
    assert.equal(empty?.stage, 'design')
  })

  it('advanceStage is forward-only and blocked from measure without products', () => {
    const created = usePlanStore.getState().createPlan({ title: 'A', roomType: 'living', areaM2: 12 })
    if (!created.ok) throw new Error('expected plan')
    const id = created.plan.id
    assert.equal(usePlanStore.getState().advanceStage(id), false)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'measure')

    usePlanStore.getState().addProductToActivePlan('p-1')
    assert.equal(usePlanStore.getState().advanceStage(id), true)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'design')
    assert.equal(usePlanStore.getState().advanceStage(id), true)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'construct')
    assert.equal(usePlanStore.getState().advanceStage(id), true)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'accept')
    assert.equal(usePlanStore.getState().advanceStage(id), false)
    assert.equal(selectActivePlan(usePlanStore.getState())?.stage, 'accept')
  })

  it('hydrate restores plans and activePlanId from fd:plans', () => {
    const persisted: Plan = samplePlan({
      id: 'plan-restore',
      title: '书房',
      roomType: 'study',
      areaM2: 9,
      stage: 'design',
      productIds: ['p-chair-luxury-10'],
      coverProductId: 'p-chair-luxury-10',
    })
    const memory = createMemoryStorage({
      [PLANS_STORAGE_KEY]: JSON.stringify({
        plans: [persisted],
        activePlanId: 'plan-restore',
      }),
    })
    configureStorage(memory)
    usePlanStore.setState({ plans: [], activePlanId: null, activePlanUpdatedAt: null })
    usePlanStore.getState().hydrate()
    assert.equal(usePlanStore.getState().activePlanId, 'plan-restore')
    assert.deepEqual(usePlanStore.getState().plans, [persisted])
  })

  it('reset clears plans memory and fd:plans', () => {
    const created = usePlanStore.getState().createPlan({
      title: '客厅',
      roomType: 'living',
      areaM2: 32,
    })
    assert.equal(created.ok, true)
    usePlanStore.getState().reset()
    assert.deepEqual(usePlanStore.getState().plans, [])
    assert.equal(usePlanStore.getState().activePlanId, null)
    assert.deepEqual(readJSON(PLANS_STORAGE_KEY, { keep: true }), {
      plans: [],
      activePlanId: null,
      activePlanUpdatedAt: null,
    })
  })

  it('deletePlan removes the plan and setActivePlanId refreshes activePlanUpdatedAt', () => {
    const created = usePlanStore.getState().createPlan({ title: '客厅', roomType: 'living', areaM2: 20 })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('plan')
    const stamped = usePlanStore.getState().activePlanUpdatedAt
    assert.match(stamped ?? '', /^\d{4}-\d{2}-\d{2}T/)
    usePlanStore.getState().setActivePlanId(created.plan.id)
    assert.ok((usePlanStore.getState().activePlanUpdatedAt ?? '') >= (stamped ?? ''))
    usePlanStore.getState().deletePlan(created.plan.id)
    assert.deepEqual(usePlanStore.getState().plans, [])
    assert.equal(usePlanStore.getState().activePlanId, null)
  })
})

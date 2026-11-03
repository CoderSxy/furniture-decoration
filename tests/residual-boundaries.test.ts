import assert from 'node:assert/strict'
import test from 'node:test'
import { validateCreatePlan } from '../src/utils/plans.ts'
import { computeTotalFen, buildBudget } from '../src/utils/budget.ts'
import { parsePersistedPlans } from '../src/stores/planStore.ts'
import { parsePersistedScans, useScanStore } from '../src/stores/scanStore.ts'
import { parsePositiveMm } from '../src/utils/scanMeasure.ts'

test('area input, hydrate and budget reject excessive area without nonfinite money', () => {
  assert.equal(validateCreatePlan({ title: 'x', roomType: 'living', areaM2: 1e308 }), 'invalid-area')
  assert.equal(computeTotalFen(1e308), 0)
  const budget = buildBudget({ id: 'p', areaM2: 1e308, productIds: [] }, [])
  assert.ok(Object.values(budget.spentByCategory).every(Number.isSafeInteger))
  const plan = { id: 'p', title: 'x', roomType: 'living', stage: 'measure', areaM2: 10001, createdAt: 'now', updatedAt: 'now' }
  assert.equal(parsePersistedPlans({ plans: [plan] }).plans.length, 0)
})

test('scan hydrate and upsert share dimension bounds and three-photo limit', () => {
  const valid = { planId: 'p', source: 'manual' as const, widthMm: 4000, depthMm: 3000, heightMm: 2800, photoPaths: [], capturedAt: 'now' }
  for (const widthMm of [0, -1, Infinity, NaN, 100001]) {
    assert.deepEqual(parsePersistedScans({ p: { ...valid, widthMm } }), {})
    useScanStore.setState({ scans: {} })
    useScanStore.getState().upsert({ ...valid, widthMm })
    assert.deepEqual(useScanStore.getState().scans, {})
  }
  const photos = { ...valid, photoPaths: ['a', 'b', 'c', 'd'] }
  assert.deepEqual(parsePersistedScans({ p: photos }), {})
  useScanStore.getState().upsert(photos)
  assert.deepEqual(useScanStore.getState().scans, {})
  assert.equal(parsePositiveMm('100001'), null)
})

test('budget hydration drops unsafe amounts', async () => {
  const { parsePersistedBudgets } = await import('../src/stores/budgetStore.ts')
  assert.deepEqual(parsePersistedBudgets({ p: { planId: 'p', totalFen: 1e308,
    spentByCategory: { furniture: 0, material: 0, labor: 0, other: 0 } } }), {})
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { planDetailUrl, productDetailUrl } from '../src/utils/navigation.ts'

test('productDetailUrl only passes productId', () => {
  assert.equal(
    productDetailUrl('p-sofa-modern-01'),
    '/pages/catalog/detail?productId=p-sofa-modern-01',
  )
})

test('planDetailUrl only passes planId', () => {
  assert.equal(planDetailUrl('plan-1'), '/pages/plans/detail?planId=plan-1')
  assert.equal(
    planDetailUrl('plan/weird'),
    '/pages/plans/detail?planId=plan%2Fweird',
  )
})

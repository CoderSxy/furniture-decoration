import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiRecommendUrl,
  loginPageUrl,
  planDetailUrl,
  previewPageUrl,
  productDetailUrl,
  scanPageUrl,
} from '../src/utils/navigation.ts'

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

test('scanPageUrl stays in packageScan and only passes planId', () => {
  assert.equal(
    scanPageUrl('plan-1'),
    '/packageScan/pages/scan/index?planId=plan-1',
  )
  assert.equal(
    scanPageUrl('plan/weird'),
    '/packageScan/pages/scan/index?planId=plan%2Fweird',
  )
})

test('loginPageUrl is a non-tab path', () => {
  assert.equal(loginPageUrl(), '/pages/login/index')
})

test('aiRecommendUrl and previewPageUrl stay in packagePreview and only pass planId', () => {
  assert.equal(
    aiRecommendUrl('plan-1'),
    '/packagePreview/pages/ai/recommend?planId=plan-1',
  )
  assert.equal(
    previewPageUrl('plan-1'),
    '/packagePreview/pages/preview/index?planId=plan-1',
  )
  assert.equal(
    aiRecommendUrl('plan/weird'),
    '/packagePreview/pages/ai/recommend?planId=plan%2Fweird',
  )
  assert.equal(
    previewPageUrl('plan/weird'),
    '/packagePreview/pages/preview/index?planId=plan%2Fweird',
  )
})

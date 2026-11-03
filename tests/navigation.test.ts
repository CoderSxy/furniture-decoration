import assert from 'node:assert/strict'
import test from 'node:test'
import { productDetailUrl } from '../src/utils/navigation.ts'

test('productDetailUrl only passes productId', () => {
  assert.equal(
    productDetailUrl('p-sofa-modern-01'),
    '/pages/catalog/detail?productId=p-sofa-modern-01',
  )
})

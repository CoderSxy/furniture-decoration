import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import {
  DEFAULT_FILTERS,
  selectFilteredProducts,
  useCatalogStore,
} from '../src/stores/catalogStore.ts'

test('setFilters patches and clearFilters restores full mock list', () => {
  useCatalogStore.setState({
    products: PRODUCTS,
    filters: { ...DEFAULT_FILTERS },
  })

  useCatalogStore.getState().setFilters({ category: 'sofa', room: 'living' })
  assert.equal(useCatalogStore.getState().filters.category, 'sofa')
  assert.equal(useCatalogStore.getState().filters.room, 'living')
  assert.equal(useCatalogStore.getState().filters.style, 'all')

  const sofaLiving = selectFilteredProducts(useCatalogStore.getState())
  assert.ok(sofaLiving.length >= 1)
  assert.ok(sofaLiving.every((item) => item.category === 'sofa' && item.rooms.includes('living')))
  assert.ok(sofaLiving.length < PRODUCTS.length)

  useCatalogStore.getState().clearFilters()
  assert.deepEqual(useCatalogStore.getState().filters, DEFAULT_FILTERS)
  assert.equal(selectFilteredProducts(useCatalogStore.getState()).length, PRODUCTS.length)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTS } from '../src/mocks/products.ts'
import { matchesPriceRange } from '../src/utils/price.ts'
import type { ProductCategory, RoomType, StyleTag } from '../src/types/domain.ts'

const ALL_CATEGORIES: ProductCategory[] = [
  'sofa',
  'bed',
  'table',
  'cabinet',
  'chair',
  'light',
  'other',
]

test('mock catalog meets M1 breadth rules', () => {
  assert.ok(PRODUCTS.length >= 12, 'need at least 12 products')
  const ids = PRODUCTS.map((item) => item.id)
  assert.equal(ids.length, new Set(ids).size)

  for (const category of ALL_CATEGORIES) {
    assert.ok(
      PRODUCTS.some((item) => item.category === category),
      `missing category ${category}`,
    )
  }

  const styles = new Set<StyleTag>(PRODUCTS.map((item) => item.style))
  assert.ok(styles.size >= 3, `styles=${[...styles]}`)

  const rooms = new Set<RoomType>(PRODUCTS.flatMap((item) => item.rooms))
  assert.ok(rooms.size >= 3, `rooms=${[...rooms]}`)

  for (const range of ['lt1000', '1000to3000', '3000to8000', 'gte8000'] as const) {
    assert.ok(
      PRODUCTS.some((item) => matchesPriceRange(item.priceFen, range)),
      `missing price band ${range}`,
    )
  }

  for (const product of PRODUCTS) {
    assert.ok(product.id.length > 0)
    assert.ok(product.name.length > 0)
    assert.ok(Number.isInteger(product.priceFen) && product.priceFen > 0)
    assert.ok(product.coverUrl.startsWith('https://'))
    assert.ok(Array.isArray(product.imageUrls) && product.imageUrls.length >= 1)
    assert.ok(product.sizeMm.w > 0 && product.sizeMm.d > 0 && product.sizeMm.h > 0)
    assert.ok(product.material.length > 0)
    assert.ok(product.description.length > 0)
    assert.ok(product.rooms.length >= 1)
  }
})

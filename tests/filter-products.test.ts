import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterProducts,
  hasActiveFilters,
  summarizeFilters,
} from '../src/utils/filterProducts.ts'
import type { CatalogFilters, Product } from '../src/types/domain.ts'

const DEFAULT_FILTERS: CatalogFilters = {
  category: 'all',
  room: 'all',
  style: 'all',
  priceRange: 'all',
}

const FIXTURES: Product[] = [
  {
    id: 'a',
    name: 'A 沙发',
    category: 'sofa',
    rooms: ['living'],
    style: 'modern',
    priceFen: 299900,
    coverUrl: 'https://example.com/a.jpg',
    imageUrls: ['https://example.com/a.jpg'],
    sizeMm: { w: 1, d: 1, h: 1 },
    material: '布',
    description: 'A',
  },
  {
    id: 'b',
    name: 'B 床',
    category: 'bed',
    rooms: ['bedroom'],
    style: 'chinese',
    priceFen: 1280000,
    coverUrl: 'https://example.com/b.jpg',
    imageUrls: ['https://example.com/b.jpg'],
    sizeMm: { w: 1, d: 1, h: 1 },
    material: '木',
    description: 'B',
  },
  {
    id: 'c',
    name: 'C 茶几',
    category: 'table',
    rooms: ['living', 'study'],
    style: 'nordic',
    priceFen: 89900,
    coverUrl: 'https://example.com/c.jpg',
    imageUrls: ['https://example.com/c.jpg'],
    sizeMm: { w: 1, d: 1, h: 1 },
    material: '木',
    description: 'C',
  },
]

test('combined filters keep only products matching every dimension', () => {
  const filtered = filterProducts(FIXTURES, {
    category: 'sofa',
    room: 'living',
    style: 'modern',
    priceRange: '1000to3000',
  })
  assert.deepEqual(
    filtered.map((item) => item.id),
    ['a'],
  )
})

test('room filter matches any of product.rooms', () => {
  const filtered = filterProducts(FIXTURES, {
    ...DEFAULT_FILTERS,
    room: 'study',
  })
  assert.deepEqual(
    filtered.map((item) => item.id),
    ['c'],
  )
})

test('clearing filters (all/all/all/all) restores the full list', () => {
  const filtered = filterProducts(FIXTURES, DEFAULT_FILTERS)
  assert.deepEqual(
    filtered.map((item) => item.id),
    ['a', 'b', 'c'],
  )
})

test('impossible combo yields an empty list', () => {
  const filtered = filterProducts(FIXTURES, {
    category: 'bed',
    room: 'living',
    style: 'all',
    priceRange: 'all',
  })
  assert.deepEqual(filtered, [])
})

test('summarizeFilters uses chinese labels and 全部商品', () => {
  assert.equal(hasActiveFilters(DEFAULT_FILTERS), false)
  assert.equal(summarizeFilters(DEFAULT_FILTERS), '全部商品')
  const active: CatalogFilters = {
    category: 'sofa',
    room: 'living',
    style: 'modern',
    priceRange: 'lt1000',
  }
  assert.equal(hasActiveFilters(active), true)
  assert.equal(summarizeFilters(active), '沙发 · 客厅 · 现代 · 1千以下')
})

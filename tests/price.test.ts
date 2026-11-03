import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPriceYuan, matchesPriceRange, priceFenToYuan } from '../src/utils/price.ts'

test('priceFenToYuan rounds to yuan and never keeps fen', () => {
  assert.equal(priceFenToYuan(129900), 1299)
  assert.equal(priceFenToYuan(10050), 101)
  assert.equal(priceFenToYuan(10049), 100)
  assert.equal(formatPriceYuan(129900), '¥1299')
  assert.equal(formatPriceYuan(19999), '¥200')
  assert.equal(formatPriceYuan(0).includes('分'), false)
})

test('matchesPriceRange uses inclusive lower bounds without overlap', () => {
  assert.equal(matchesPriceRange(99900, 'lt1000'), true)
  assert.equal(matchesPriceRange(100000, 'lt1000'), false)
  assert.equal(matchesPriceRange(100000, '1000to3000'), true)
  assert.equal(matchesPriceRange(299900, '1000to3000'), true)
  assert.equal(matchesPriceRange(300000, '1000to3000'), false)
  assert.equal(matchesPriceRange(300000, '3000to8000'), true)
  assert.equal(matchesPriceRange(799900, '3000to8000'), true)
  assert.equal(matchesPriceRange(800000, '3000to8000'), false)
  assert.equal(matchesPriceRange(800000, 'gte8000'), true)
  assert.equal(matchesPriceRange(99949, 'lt1000'), true)
  assert.equal(matchesPriceRange(99950, '1000to3000'), true)
  assert.equal(matchesPriceRange(45000, 'all'), true)
  assert.equal(matchesPriceRange(960000, 'all'), true)
})

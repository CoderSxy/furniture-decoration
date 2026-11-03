import {
  CATEGORY_LABELS,
  PRICE_RANGE_LABELS,
  ROOM_LABELS,
  STYLE_LABELS,
} from '../constants/labels'
import type { CatalogFilters, Product } from '../types/domain'
import { matchesPriceRange } from './price'

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  return products.filter((product) => {
    if (filters.category !== 'all' && product.category !== filters.category) return false
    if (filters.room !== 'all' && !product.rooms.includes(filters.room)) return false
    if (filters.style !== 'all' && product.style !== filters.style) return false
    if (!matchesPriceRange(product.priceFen, filters.priceRange)) return false
    return true
  })
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.category !== 'all' ||
    filters.room !== 'all' ||
    filters.style !== 'all' ||
    filters.priceRange !== 'all'
  )
}

export function summarizeFilters(filters: CatalogFilters): string {
  if (!hasActiveFilters(filters)) return '全部商品'
  const parts: string[] = []
  if (filters.category !== 'all') parts.push(CATEGORY_LABELS[filters.category])
  if (filters.room !== 'all') parts.push(ROOM_LABELS[filters.room])
  if (filters.style !== 'all') parts.push(STYLE_LABELS[filters.style])
  if (filters.priceRange !== 'all') parts.push(PRICE_RANGE_LABELS[filters.priceRange])
  return parts.join(' · ')
}

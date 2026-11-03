import type { PriceRange } from '../types/domain'

export function priceFenToYuan(priceFen: number): number {
  return Math.round(priceFen / 100)
}

export function formatPriceYuan(priceFen: number): string {
  return `¥${priceFenToYuan(priceFen)}`
}

export function matchesPriceRange(priceFen: number, range: PriceRange): boolean {
  if (range === 'all') return true
  const yuan = priceFenToYuan(priceFen)
  if (range === 'lt1000') return yuan < 1000
  if (range === '1000to3000') return yuan >= 1000 && yuan < 3000
  if (range === '3000to8000') return yuan >= 3000 && yuan < 8000
  return yuan >= 8000
}

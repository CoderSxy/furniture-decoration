import { create } from 'zustand'
import type { CatalogFilters, Product } from '../types/domain'

export type CatalogState = {
  products: Product[]
  filters: CatalogFilters
}

export const useCatalogStore = create<CatalogState>(() => ({
  products: [],
  filters: {
    category: 'all',
    room: 'all',
    style: 'all',
    priceRange: 'all',
  },
}))

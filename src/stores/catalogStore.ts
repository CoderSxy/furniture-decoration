import { create } from 'zustand'
import { PRODUCTS } from '../mocks/products'
import type { CatalogFilters, Product } from '../types/domain'
import { filterProducts } from '../utils/filterProducts'

export const DEFAULT_FILTERS: CatalogFilters = {
  category: 'all',
  room: 'all',
  style: 'all',
  priceRange: 'all',
}

export type CatalogState = {
  products: Product[]
  filters: CatalogFilters
  setFilters: (patch: Partial<CatalogFilters>) => void
  clearFilters: () => void
}

export const useCatalogStore = create<CatalogState>((set) => ({
  products: PRODUCTS,
  filters: { ...DEFAULT_FILTERS },
  setFilters: (patch) =>
    set((state) => ({
      filters: { ...state.filters, ...patch },
    })),
  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}))

export function selectFilteredProducts(state: CatalogState): Product[] {
  return filterProducts(state.products, state.filters)
}

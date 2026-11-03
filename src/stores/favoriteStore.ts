// src/stores/favoriteStore.ts
import { create } from 'zustand'
import { FAVORITES_STORAGE_KEY } from '../constants/storageKeys'
import type { FavoriteRecord } from '../types/domain'
import { readJSON, writeJSON } from '../utils/storage'

export function parseFavoriteRecords(input: unknown): FavoriteRecord[] {
  if (!Array.isArray(input)) return []
  const records: FavoriteRecord[] = []
  for (const row of input) {
    if (row == null || typeof row !== 'object') continue
    const productId = (row as { productId?: unknown }).productId
    const savedAt = (row as { savedAt?: unknown }).savedAt
    if (typeof productId !== 'string' || productId.length === 0) continue
    if (typeof savedAt !== 'string' || savedAt.length === 0) continue
    records.push({ productId, savedAt })
  }
  return records
}

export type FavoriteState = {
  items: FavoriteRecord[]
  hydrate: () => void
  toggleFavorite: (productId: string) => void
  isFavorite: (productId: string) => boolean
  reset: () => void
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  items: [],
  hydrate: () => {
    set({ items: parseFavoriteRecords(readJSON(FAVORITES_STORAGE_KEY, [])) })
  },
  toggleFavorite: (productId: string) => {
    const current = get().items
    const exists = current.some((item) => item.productId === productId)
    const items = exists
      ? current.filter((item) => item.productId !== productId)
      : [...current, { productId, savedAt: new Date().toISOString() }]
    writeJSON(FAVORITES_STORAGE_KEY, items)
    set({ items })
  },
  isFavorite: (productId: string) => get().items.some((item) => item.productId === productId),
  reset: () => {
    writeJSON(FAVORITES_STORAGE_KEY, [])
    set({ items: [] })
  },
}))

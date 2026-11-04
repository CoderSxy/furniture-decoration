// src/stores/favoriteStore.ts
import { create } from 'zustand'
import { FAVORITES_STORAGE_KEY } from '../constants/storageKeys'
import type { FavoriteRecord } from '../types/domain'
import { readJSON, writeJSON } from '../utils/storage'
import { schedulePush } from '../utils/syncNotify'
import { recordTombstone } from '../utils/tombstones'

export function parseFavoriteRecords(input: unknown): FavoriteRecord[] {
  if (!Array.isArray(input)) return []
  const records: FavoriteRecord[] = []
  for (const row of input) {
    if (row == null || typeof row !== 'object') continue
    const productId = (row as { productId?: unknown }).productId
    const savedAt = (row as { savedAt?: unknown }).savedAt
    const updatedAt = (row as { updatedAt?: unknown }).updatedAt
    if (typeof productId !== 'string' || productId.length === 0) continue
    if (typeof savedAt !== 'string' || savedAt.length === 0) continue
    records.push({
      productId,
      savedAt,
      updatedAt: typeof updatedAt === 'string' && updatedAt.length > 0 ? updatedAt : savedAt,
    })
  }
  return records
}

export type FavoriteState = {
  items: FavoriteRecord[]
  hydrate: () => void
  toggleFavorite: (productId: string) => void
  isFavorite: (productId: string) => boolean
  replaceAll: (items: FavoriteRecord[]) => void
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
    const now = new Date().toISOString()
    const items = exists
      ? current.filter((item) => item.productId !== productId)
      : [...current, { productId, savedAt: now, updatedAt: now }]
    if (exists) recordTombstone('favorite', productId, now)
    writeJSON(FAVORITES_STORAGE_KEY, items)
    set({ items })
    schedulePush()
  },
  isFavorite: (productId: string) => get().items.some((item) => item.productId === productId),
  replaceAll: (items) => {
    writeJSON(FAVORITES_STORAGE_KEY, items)
    set({ items })
  },
  reset: () => {
    writeJSON(FAVORITES_STORAGE_KEY, [])
    set({ items: [] })
  },
}))

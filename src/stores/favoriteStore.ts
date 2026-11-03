import { create } from 'zustand'
import type { FavoriteRecord } from '../types/domain'

export type FavoriteState = {
  items: FavoriteRecord[]
}

export const useFavoriteStore = create<FavoriteState>(() => ({
  items: [],
}))

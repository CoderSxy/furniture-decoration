import { create } from 'zustand'

export type UiState = {
  filterPanelOpen: boolean
}

export const useUiStore = create<UiState>(() => ({
  filterPanelOpen: false,
}))

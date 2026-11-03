import { create } from 'zustand'

export type UiState = {
  filterPanelOpen: boolean
  setFilterPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  filterPanelOpen: false,
  setFilterPanelOpen: (open) => set({ filterPanelOpen: open }),
}))

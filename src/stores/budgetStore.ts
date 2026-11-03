import { create } from 'zustand'
import type { Budget } from '../types/domain'

export type BudgetState = {
  budgets: Record<string, Budget>
}

export const useBudgetStore = create<BudgetState>(() => ({
  budgets: {},
}))

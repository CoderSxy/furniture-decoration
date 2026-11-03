// src/stores/budgetStore.ts
import { create } from 'zustand'
import { BUDGETS_STORAGE_KEY } from '../constants/storageKeys'
import type { Budget, BudgetCategory, Plan, Product } from '../types/domain'
import { buildBudget } from '../utils/budget'
import { readJSON, writeJSON } from '../utils/storage'

const CATEGORIES: readonly BudgetCategory[] = ['furniture', 'material', 'labor', 'other']

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parseBudget(key: string, input: unknown): Budget | null {
  if (input == null || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  if (typeof row.planId !== 'string' || row.planId.length === 0) return null
  if (row.planId !== key) return null
  if (!isNonNegativeFinite(row.totalFen)) return null
  const spentRaw = row.spentByCategory
  if (spentRaw == null || typeof spentRaw !== 'object') return null
  const spent = spentRaw as Record<string, unknown>
  const spentByCategory = {} as Record<BudgetCategory, number>
  for (const category of CATEGORIES) {
    if (!isNonNegativeFinite(spent[category])) return null
    spentByCategory[category] = spent[category]
  }
  return {
    planId: row.planId,
    totalFen: row.totalFen,
    spentByCategory,
  }
}

export function parsePersistedBudgets(input: unknown): Record<string, Budget> {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return {}
  const result: Record<string, Budget> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const budget = parseBudget(key, value)
    if (budget) result[key] = budget
  }
  return result
}

function persist(budgets: Record<string, Budget>): void {
  writeJSON(BUDGETS_STORAGE_KEY, budgets)
}

export type BudgetState = {
  budgets: Record<string, Budget>
  hydrate: () => void
  ensureForPlan: (
    plan: Pick<Plan, 'id' | 'areaM2' | 'productIds'>,
    products: readonly Product[],
  ) => Budget
  ensureForPlans: (
    plans: Array<Pick<Plan, 'id' | 'areaM2' | 'productIds'>>,
    products: readonly Product[],
  ) => void
  reset: () => void
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: {},
  hydrate: () => {
    set({ budgets: parsePersistedBudgets(readJSON<unknown>(BUDGETS_STORAGE_KEY, null)) })
  },
  ensureForPlan: (plan, products) => {
    const budget = buildBudget(plan, products)
    const budgets = { ...get().budgets, [plan.id]: budget }
    persist(budgets)
    set({ budgets })
    return budget
  },
  ensureForPlans: (plans, products) => {
    const budgets: Record<string, Budget> = {}
    for (const plan of plans) {
      budgets[plan.id] = buildBudget(plan, products)
    }
    persist(budgets)
    set({ budgets })
  },
  reset: () => {
    persist({})
    set({ budgets: {} })
  },
}))

export function selectBudgetByPlanId(state: BudgetState, planId: string): Budget | undefined {
  return state.budgets[planId]
}

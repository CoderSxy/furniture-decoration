import { create } from 'zustand'
import type { Plan } from '../types/domain'

export type PlanState = {
  plans: Plan[]
  activePlanId: string | null
}

export const usePlanStore = create<PlanState>(() => ({
  plans: [],
  activePlanId: null,
}))

import { create } from 'zustand'
import { ROOM_CREATE_OPTIONS, STAGE_ORDER } from '../constants/labels'
import { PLANS_STORAGE_KEY } from '../constants/storageKeys'
import type { Plan, PlanStage, RoomType } from '../types/domain'
import {
  canAdvanceStage,
  createPlanId,
  nextStage,
  validateCreatePlan,
  type CreatePlanError,
  type CreatePlanInput,
} from '../utils/plans'
import { readJSON, writeJSON } from '../utils/storage'

export type PersistedPlans = {
  plans: Plan[]
  activePlanId: string | null
}

export type AddProductResult = 'added' | 'duplicate' | 'no-active-plan'

export type CreatePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: CreatePlanError }

function isRoomType(value: unknown): value is RoomType {
  return typeof value === 'string' && (ROOM_CREATE_OPTIONS as readonly string[]).includes(value)
}

function isPlanStage(value: unknown): value is PlanStage {
  return typeof value === 'string' && (STAGE_ORDER as readonly string[]).includes(value)
}

function parseProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const ids: string[] = []
  for (const item of input) {
    if (typeof item !== 'string' || item.length === 0) continue
    if (!ids.includes(item)) ids.push(item)
  }
  return ids
}

function parsePlan(input: unknown): Plan | null {
  if (input == null || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  if (typeof row.id !== 'string' || row.id.length === 0) return null
  if (typeof row.title !== 'string' || row.title.trim().length === 0) return null
  if (!isRoomType(row.roomType)) return null
  if (typeof row.areaM2 !== 'number' || !Number.isFinite(row.areaM2) || row.areaM2 <= 0) return null
  if (!isPlanStage(row.stage)) return null
  if (typeof row.createdAt !== 'string' || row.createdAt.length === 0) return null
  if (typeof row.updatedAt !== 'string' || row.updatedAt.length === 0) return null
  const productIds = parseProductIds(row.productIds)
  const plan: Plan = {
    id: row.id,
    title: row.title,
    roomType: row.roomType,
    areaM2: row.areaM2,
    stage: row.stage,
    productIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
  if (typeof row.coverProductId === 'string' && row.coverProductId.length > 0) {
    plan.coverProductId = row.coverProductId
  }
  return plan
}

export function parsePersistedPlans(input: unknown): PersistedPlans {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { plans: [], activePlanId: null }
  }
  const row = input as { plans?: unknown; activePlanId?: unknown }
  const plans = Array.isArray(row.plans)
    ? row.plans.map(parsePlan).filter((item): item is Plan => item != null)
    : []
  const activePlanId =
    typeof row.activePlanId === 'string' && plans.some((item) => item.id === row.activePlanId)
      ? row.activePlanId
      : null
  return { plans, activePlanId }
}

function persist(plans: Plan[], activePlanId: string | null): void {
  const payload: PersistedPlans = { plans, activePlanId }
  writeJSON(PLANS_STORAGE_KEY, payload)
}

export type PlanState = {
  plans: Plan[]
  activePlanId: string | null
  hydrate: () => void
  createPlan: (input: CreatePlanInput) => CreatePlanResult
  setActivePlanId: (planId: string) => void
  addProductToActivePlan: (productId: string) => AddProductResult
  removeProductFromPlan: (planId: string, productId: string) => void
  advanceStage: (planId: string) => boolean
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  activePlanId: null,
  hydrate: () => {
    const parsed = parsePersistedPlans(readJSON<unknown>(PLANS_STORAGE_KEY, null))
    set(parsed)
  },
  createPlan: (input) => {
    const reason = validateCreatePlan(input)
    if (reason !== 'ok') return { ok: false, reason }
    const now = new Date().toISOString()
    const plan: Plan = {
      id: createPlanId(),
      title: input.title.trim(),
      roomType: input.roomType,
      areaM2: input.areaM2,
      stage: 'measure',
      productIds: [],
      createdAt: now,
      updatedAt: now,
    }
    const plans = [...get().plans, plan]
    persist(plans, plan.id)
    set({ plans, activePlanId: plan.id })
    return { ok: true, plan }
  },
  setActivePlanId: (planId) => {
    if (!get().plans.some((item) => item.id === planId)) return
    persist(get().plans, planId)
    set({ activePlanId: planId })
  },
  addProductToActivePlan: (productId) => {
    const { plans, activePlanId } = get()
    if (activePlanId == null) return 'no-active-plan'
    const current = plans.find((item) => item.id === activePlanId)
    if (!current) return 'no-active-plan'
    if (current.productIds.includes(productId)) return 'duplicate'
    const productIds = [...current.productIds, productId]
    const coverProductId = current.coverProductId ?? productId
    const next = plans.map((item) =>
      item.id === activePlanId
        ? { ...item, productIds, coverProductId, updatedAt: new Date().toISOString() }
        : item,
    )
    persist(next, activePlanId)
    set({ plans: next })
    return 'added'
  },
  removeProductFromPlan: (planId, productId) => {
    const next = get().plans.map((item) => {
      if (item.id !== planId) return item
      const productIds = item.productIds.filter((id) => id !== productId)
      const coverProductId =
        item.coverProductId === productId ? productIds[0] : item.coverProductId
      return { ...item, productIds, coverProductId, updatedAt: new Date().toISOString() }
    })
    persist(next, get().activePlanId)
    set({ plans: next })
  },
  advanceStage: (planId) => {
    const current = get().plans.find((item) => item.id === planId)
    if (!current || !canAdvanceStage(current)) return false
    const stage = nextStage(current.stage)
    if (stage == null) return false
    const next = get().plans.map((item) =>
      item.id === planId ? { ...item, stage, updatedAt: new Date().toISOString() } : item,
    )
    persist(next, get().activePlanId)
    set({ plans: next })
    return true
  },
}))

export function selectActivePlan(state: PlanState): Plan | undefined {
  if (state.activePlanId == null) return undefined
  return state.plans.find((item) => item.id === state.activePlanId)
}

export function selectPlanById(state: PlanState, planId: string): Plan | undefined {
  return state.plans.find((item) => item.id === planId)
}

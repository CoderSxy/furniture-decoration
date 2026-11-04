import { isValidArea } from '../utils/domainLimits'
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
import { schedulePush } from '../utils/syncNotify'

export type PersistedPlans = {
  plans: Plan[]
  activePlanId: string | null
  activePlanUpdatedAt: string | null
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
  if (!isValidArea(row.areaM2)) return null
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
    return { plans: [], activePlanId: null, activePlanUpdatedAt: null }
  }
  const row = input as { plans?: unknown; activePlanId?: unknown; activePlanUpdatedAt?: unknown }
  const plans = Array.isArray(row.plans)
    ? row.plans.map(parsePlan).filter((item): item is Plan => item != null)
    : []
  const activePlanId =
    typeof row.activePlanId === 'string' && plans.some((item) => item.id === row.activePlanId)
      ? row.activePlanId
      : null
  const activePlanUpdatedAt =
    typeof row.activePlanUpdatedAt === 'string' && row.activePlanUpdatedAt.length > 0
      ? row.activePlanUpdatedAt
      : null
  return { plans, activePlanId, activePlanUpdatedAt }
}

function persist(
  plans: Plan[],
  activePlanId: string | null,
  activePlanUpdatedAt: string | null,
): void {
  const payload: PersistedPlans = { plans, activePlanId, activePlanUpdatedAt }
  writeJSON(PLANS_STORAGE_KEY, payload)
}

export type PlanState = {
  plans: Plan[]
  activePlanId: string | null
  activePlanUpdatedAt: string | null
  hydrate: () => void
  createPlan: (input: CreatePlanInput) => CreatePlanResult
  setActivePlanId: (planId: string) => void
  addProductToPlan: (planId: string, productId: string) => AddProductResult
  addProductToActivePlan: (productId: string) => AddProductResult
  removeProductFromPlan: (planId: string, productId: string) => void
  advanceStage: (planId: string) => boolean
  deletePlan: (planId: string) => void
  replaceAll: (input: PersistedPlans) => void
  reset: () => void
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  activePlanId: null,
  activePlanUpdatedAt: null,
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
    persist(plans, plan.id, now)
    set({ plans, activePlanId: plan.id, activePlanUpdatedAt: now })
    schedulePush()
    return { ok: true, plan }
  },
  setActivePlanId: (planId) => {
    if (!get().plans.some((item) => item.id === planId)) return
    const now = new Date().toISOString()
    persist(get().plans, planId, now)
    set({ activePlanId: planId, activePlanUpdatedAt: now })
    schedulePush()
  },
  addProductToPlan: (planId, productId) => {
    const { plans, activePlanId, activePlanUpdatedAt } = get()
    const current = plans.find((item) => item.id === planId)
    if (!current) return 'no-active-plan'
    if (current.productIds.includes(productId)) return 'duplicate'
    const productIds = [...current.productIds, productId]
    const coverProductId = current.coverProductId ?? productId
    const next = plans.map((item) =>
      item.id === planId
        ? { ...item, productIds, coverProductId, updatedAt: new Date().toISOString() }
        : item,
    )
    persist(next, activePlanId, activePlanUpdatedAt)
    set({ plans: next })
    schedulePush()
    return 'added'
  },
  addProductToActivePlan: (productId) => {
    const { activePlanId } = get()
    if (activePlanId == null) return 'no-active-plan'
    return get().addProductToPlan(activePlanId, productId)
  },
  removeProductFromPlan: (planId, productId) => {
    const next = get().plans.map((item) => {
      if (item.id !== planId) return item
      const productIds = item.productIds.filter((id) => id !== productId)
      const coverProductId =
        item.coverProductId === productId ? productIds[0] : item.coverProductId
      return { ...item, productIds, coverProductId, updatedAt: new Date().toISOString() }
    })
    persist(next, get().activePlanId, get().activePlanUpdatedAt)
    set({ plans: next })
    schedulePush()
  },
  advanceStage: (planId) => {
    const current = get().plans.find((item) => item.id === planId)
    if (!current || !canAdvanceStage(current)) return false
    const stage = nextStage(current.stage)
    if (stage == null) return false
    const next = get().plans.map((item) =>
      item.id === planId ? { ...item, stage, updatedAt: new Date().toISOString() } : item,
    )
    persist(next, get().activePlanId, get().activePlanUpdatedAt)
    set({ plans: next })
    schedulePush()
    return true
  },
  deletePlan: (planId) => {
    const plans = get().plans.filter((item) => item.id !== planId)
    let activePlanId = get().activePlanId
    let activePlanUpdatedAt = get().activePlanUpdatedAt
    if (activePlanId === planId) {
      const newest = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      activePlanId = newest?.id ?? null
      activePlanUpdatedAt = new Date().toISOString()
    }
    persist(plans, activePlanId, activePlanUpdatedAt)
    set({ plans, activePlanId, activePlanUpdatedAt })
  },
  replaceAll: (input) => {
    persist(input.plans, input.activePlanId, input.activePlanUpdatedAt)
    set(input)
  },
  reset: () => {
    persist([], null, null)
    set({ plans: [], activePlanId: null, activePlanUpdatedAt: null })
  },
}))

export function selectActivePlan(state: PlanState): Plan | undefined {
  if (state.activePlanId == null) return undefined
  return state.plans.find((item) => item.id === state.activePlanId)
}

export function selectPlanById(state: PlanState, planId: string): Plan | undefined {
  return state.plans.find((item) => item.id === planId)
}

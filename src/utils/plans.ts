import { isValidArea } from './domainLimits'
import { ROOM_CREATE_OPTIONS, STAGE_ORDER } from '../constants/labels'
import type { Plan, PlanStage, RoomType } from '../types/domain'

export type CreatePlanInput = {
  title: string
  roomType: RoomType
  areaM2: number
}

export type CreatePlanError = 'invalid-title' | 'invalid-room' | 'invalid-area'

export function validateCreatePlan(input: {
  title: string
  roomType: string
  areaM2: number
}): 'ok' | CreatePlanError {
  if (input.title.trim().length === 0) return 'invalid-title'
  if (!(ROOM_CREATE_OPTIONS as readonly string[]).includes(input.roomType)) return 'invalid-room'
  if (!isValidArea(input.areaM2)) return 'invalid-area'
  return 'ok'
}

export function nextStage(stage: PlanStage): PlanStage | null {
  const index = STAGE_ORDER.indexOf(stage)
  if (index < 0 || index >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[index + 1]
}

export function advanceBlockedReason(
  plan: Pick<Plan, 'stage' | 'productIds'>,
): string | null {
  if (nextStage(plan.stage) == null) return '已验收'
  if (plan.stage === 'measure' && plan.productIds.length < 1) return '请先去选品'
  return null
}

export function canAdvanceStage(plan: Pick<Plan, 'stage' | 'productIds'>): boolean {
  return advanceBlockedReason(plan) === null
}

export function resolveCoverProductId(
  plan: Pick<Plan, 'productIds' | 'coverProductId'>,
): string | undefined {
  if (plan.coverProductId && plan.productIds.includes(plan.coverProductId)) {
    return plan.coverProductId
  }
  return plan.productIds[0]
}

export function formatPlanArea(areaM2: number): string {
  return `${areaM2}㎡`
}

export function createPlanId(): string {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

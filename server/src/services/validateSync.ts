import {
  BUDGET_CATEGORIES,
  KIND_LIMITS,
  MAX_AREA_M2,
  MAX_SCAN_DIMENSION_MM,
  ROOM_TYPES,
  SCAN_SOURCES,
  STAGES,
  STYLES,
  SYNC_KINDS,
  TOMBSTONE_LIMIT,
} from '../domain/enums.ts'
import { ApiError } from '../errors.ts'
import type { SyncKind } from '../types/sync.ts'
import { parseIso } from './merge.ts'

function fail(): never {
  throw new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isValidArea(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AREA_M2
}

function isValidScanDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_SCAN_DIMENSION_MM
}

function isIn<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function asObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) fail()
  return value as Record<string, unknown>
}

function validateFavorite(payload: Record<string, unknown>): void {
  if (!isNonEmptyString(payload.productId)) fail()
  if (!isNonEmptyString(payload.savedAt)) fail()
  if (!isNonEmptyString(payload.updatedAt)) fail()
}

function validatePlan(itemId: string, payload: Record<string, unknown>): void {
  if (payload.id !== itemId || !isNonEmptyString(payload.id)) fail()
  if (typeof payload.title !== 'string' || payload.title.trim().length === 0) fail()
  if (!isIn(payload.roomType, ROOM_TYPES)) fail()
  if (!isValidArea(payload.areaM2)) fail()
  if (!isIn(payload.stage, STAGES)) fail()
  if (!Array.isArray(payload.productIds) || payload.productIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    fail()
  }
  if (payload.coverProductId != null && (typeof payload.coverProductId !== 'string' || payload.coverProductId.length === 0)) {
    fail()
  }
  if (!isNonEmptyString(payload.createdAt)) fail()
  if (!isNonEmptyString(payload.updatedAt)) fail()
}

function validateBudget(payload: Record<string, unknown>): void {
  if (!isNonEmptyString(payload.planId)) fail()
  if (!isNonNegativeInt(payload.totalFen)) fail()
  const spent = asObject(payload.spentByCategory)
  for (const category of BUDGET_CATEGORIES) {
    if (!isNonNegativeInt(spent[category])) fail()
  }
  if (!isNonEmptyString(payload.updatedAt)) fail()
}

function validateScan(payload: Record<string, unknown>): void {
  if (!isNonEmptyString(payload.planId)) fail()
  if (!isIn(payload.source, SCAN_SOURCES)) fail()
  if (!isValidScanDimension(payload.widthMm)) fail()
  if (!isValidScanDimension(payload.depthMm)) fail()
  if (!isValidScanDimension(payload.heightMm)) fail()
  if (!Array.isArray(payload.photoPaths)) fail()
  if (!isNonEmptyString(payload.capturedAt)) fail()
  if (!isNonEmptyString(payload.updatedAt)) fail()
}

function validateAiPreview(payload: Record<string, unknown>): void {
  if (!isNonEmptyString(payload.planId)) fail()
  const request = asObject(payload.request)
  if (!isNonEmptyString(request.planId)) fail()
  if (!isIn(request.roomType, ROOM_TYPES)) fail()
  if (!isValidArea(request.areaM2)) fail()
  if (!isIn(request.style, STYLES)) fail()
  if (!isNonNegativeInt(request.budgetFen)) fail()
  if (!Array.isArray(request.existingProductIds) || request.existingProductIds.some((id) => typeof id !== 'string')) {
    fail()
  }
  if (!Array.isArray(payload.items)) fail()
  for (const row of payload.items) {
    const item = asObject(row)
    if (!isNonEmptyString(item.productId)) fail()
    if (typeof item.score !== 'number' || !Number.isFinite(item.score)) fail()
    if (typeof item.reason !== 'string') fail()
  }
  if (!isNonEmptyString(payload.updatedAt)) fail()
}

function validatePreference(itemId: string, payload: Record<string, unknown>): void {
  if (itemId !== 'activePlanId') fail()
  if (payload.activePlanId !== null && typeof payload.activePlanId !== 'string') fail()
}

function validatePayload(kind: SyncKind, itemId: string, payload: unknown): void {
  const row = asObject(payload)
  if (kind === 'favorite') validateFavorite(row)
  else if (kind === 'plan') validatePlan(itemId, row)
  else if (kind === 'budget') validateBudget(row)
  else if (kind === 'scan') validateScan(row)
  else if (kind === 'aiPreview') validateAiPreview(row)
  else validatePreference(itemId, row)
}

export function validateSyncPut(items: unknown[]): void {
  const counts: Record<SyncKind, number> = {
    favorite: 0,
    plan: 0,
    budget: 0,
    scan: 0,
    aiPreview: 0,
    preference: 0,
  }
  let tombstones = 0
  for (const raw of items) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) fail()
    const item = raw as Record<string, unknown>
    if (!isIn(item.kind, SYNC_KINDS)) fail()
    const kind = item.kind
    if (typeof item.itemId !== 'string' || item.itemId.length === 0 || item.itemId.length > 64) fail()
    if (parseIso(item.updatedAt) == null) fail()
    if (item.deleted === true) {
      if (item.payload !== null) fail()
      tombstones += 1
      continue
    }
    if (item.deleted !== false) fail()
    counts[kind] += 1
    validatePayload(kind, item.itemId, item.payload)
  }
  if (tombstones > TOMBSTONE_LIMIT) fail()
  for (const kind of SYNC_KINDS) {
    if (counts[kind] > KIND_LIMITS[kind]) fail()
  }
}

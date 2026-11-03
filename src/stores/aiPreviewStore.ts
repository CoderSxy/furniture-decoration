import { create } from 'zustand'
import { AI_PREVIEWS_STORAGE_KEY } from '../constants/storageKeys'
import type { AiRecommendItem, AiRecommendRequest } from '../types/aiRecommend'
import { readJSON, writeJSON } from '../utils/storage'
import { schedulePush } from '../utils/syncNotify'

export type AiPreviewRecord = {
  planId: string
  request: AiRecommendRequest
  items: AiRecommendItem[]
  updatedAt: string
}

function parsePreview(key: string, input: unknown): AiPreviewRecord | null {
  if (input == null || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  if (typeof row.planId !== 'string' || row.planId.length === 0 || row.planId !== key) return null
  if (row.request == null || typeof row.request !== 'object') return null
  if (!Array.isArray(row.items)) return null
  const updatedAt =
    typeof row.updatedAt === 'string' && row.updatedAt.length > 0
      ? row.updatedAt
      : '1970-01-01T00:00:00.000Z'
  return {
    planId: row.planId,
    request: row.request as AiRecommendRequest,
    items: row.items as AiRecommendItem[],
    updatedAt,
  }
}

export function parsePersistedAiPreviews(input: unknown): Record<string, AiPreviewRecord> {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return {}
  const result: Record<string, AiPreviewRecord> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const preview = parsePreview(key, value)
    if (preview) result[key] = preview
  }
  return result
}

function persist(previews: Record<string, AiPreviewRecord>): void {
  writeJSON(AI_PREVIEWS_STORAGE_KEY, previews)
}

export type AiPreviewState = {
  previews: Record<string, AiPreviewRecord>
  hydrate: () => void
  upsert: (planId: string, request: AiRecommendRequest, items: AiRecommendItem[]) => void
  removePlan: (planId: string) => void
  replaceAll: (previews: Record<string, AiPreviewRecord>) => void
  reset: () => void
}

export const useAiPreviewStore = create<AiPreviewState>((set, get) => ({
  previews: {},
  hydrate: () => {
    set({ previews: parsePersistedAiPreviews(readJSON<unknown>(AI_PREVIEWS_STORAGE_KEY, null)) })
  },
  upsert: (planId, request, items) => {
    const record: AiPreviewRecord = {
      planId,
      request,
      items,
      updatedAt: new Date().toISOString(),
    }
    const previews = { ...get().previews, [planId]: record }
    persist(previews)
    set({ previews })
    schedulePush()
  },
  removePlan: (planId) => {
    const previews = { ...get().previews }
    delete previews[planId]
    persist(previews)
    set({ previews })
  },
  replaceAll: (previews) => {
    persist(previews)
    set({ previews })
  },
  reset: () => {
    persist({})
    set({ previews: {} })
  },
}))

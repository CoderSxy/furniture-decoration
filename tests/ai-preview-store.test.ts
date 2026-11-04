import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { AI_PREVIEWS_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import { useAiPreviewStore } from '../src/stores/aiPreviewStore.ts'
import type { AiRecommendRequest } from '../src/types/aiRecommend.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

const request: AiRecommendRequest = {
  planId: 'plan-1',
  roomType: 'living',
  areaM2: 20,
  style: 'modern',
  budgetFen: 1600000,
  existingProductIds: [],
}

describe('aiPreviewStore', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useAiPreviewStore.setState({ previews: {} })
  })

  it('upsert persists a successful snapshot to fd:aiPreviews', () => {
    useAiPreviewStore.getState().upsert(request.planId, request, [
      { productId: 'p-sofa-modern-01', score: 0.9, reason: 'ok' },
    ])
    const stored = readJSON(AI_PREVIEWS_STORAGE_KEY, {}) as Record<string, { planId: string; items: unknown[] }>
    assert.equal(stored['plan-1'].planId, 'plan-1')
    assert.equal(stored['plan-1'].items.length, 1)
    assert.match(useAiPreviewStore.getState().previews['plan-1'].updatedAt, /^\d{4}-\d{2}-\d{2}T/)
  })

  it('reset clears fd:aiPreviews', () => {
    useAiPreviewStore.getState().upsert(request.planId, request, [])
    useAiPreviewStore.getState().reset()
    assert.deepEqual(useAiPreviewStore.getState().previews, {})
    assert.deepEqual(readJSON(AI_PREVIEWS_STORAGE_KEY, { keep: true }), {})
  })
})

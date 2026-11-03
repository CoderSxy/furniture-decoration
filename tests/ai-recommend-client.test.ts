import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_RECOMMEND_URL_ENV,
  fetchAiRecommendations,
} from '../src/utils/aiRecommendClient.ts'
import type { AiRecommendItem, AiRecommendRequest } from '../src/types/aiRecommend.ts'

const req: AiRecommendRequest = {
  planId: 'plan-1',
  roomType: 'living',
  areaM2: 20,
  style: 'modern',
  budgetFen: 1000,
  existingProductIds: [],
}

const mockItems: AiRecommendItem[] = [
  { productId: 'b', score: 1, reason: 'x' },
]

test('fetchAiRecommendations uses mock when URL env is empty', async () => {
  assert.equal(AI_RECOMMEND_URL_ENV, 'TARO_APP_AI_RECOMMEND_URL')
  let requested = 0
  const items = await fetchAiRecommendations(req, {
    getUrl: () => '',
    request: async () => {
      requested += 1
      return { data: [] }
    },
    recommend: async () => mockItems,
  })
  assert.equal(requested, 0)
  assert.deepEqual(items, mockItems)
})

test('fetchAiRecommendations POSTs JSON body to env URL without secrets', async () => {
  const calls: Array<{ url: string; method: string; data: unknown }> = []
  const items = await fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid/ai/recommend',
    request: async (options) => {
      calls.push({
        url: options.url,
        method: options.method,
        data: options.data,
      })
      return {
        data: [{ productId: 'remote', score: 1, reason: '远程' }],
      }
    },
    recommend: async () => {
      throw new Error('mock should not run')
    },
  })
  assert.deepEqual(calls, [
    {
      url: 'https://example.invalid/ai/recommend',
      method: 'POST',
      data: req,
    },
  ])
  assert.deepEqual(items, [{ productId: 'remote', score: 1, reason: '远程' }])
})

test('fetchAiRecommendations returns [] when remote payload is not an array', async () => {
  const items = await fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid/ai/recommend',
    request: async () => ({ data: { error: 'nope' } }),
    recommend: async () => mockItems,
  })
  assert.deepEqual(items, [])
})

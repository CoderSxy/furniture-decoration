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

test('fetchAiRecommendations rejects malformed success payload', async () => {
  await assert.rejects(fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid/ai/recommend',
    request: async () => ({ data: { error: 'nope' } }),
  }))
})

test('remote recommendations reject HTTP errors and discard malformed items', async () => {
  const deps = { getUrl: () => 'https://example.invalid' }
  await assert.rejects(fetchAiRecommendations(req, { ...deps, request: async () => ({ statusCode: 503, data: [] }) }))
  assert.deepEqual(await fetchAiRecommendations(req, { ...deps, request: async () => ({ statusCode: 200, data: [null, {}, { productId: 'a', score: Infinity, reason: 'x' }, mockItems[0]] }) }), mockItems)
})

 test('catalog association, deduplication and score bounds apply to remote results', async () => {
  const items = await fetchAiRecommendations(req, {
    getUrl: () => 'https://example.invalid',
    products: [{ id: 'known' }],
    request: async () => ({ data: [
      { productId: 'unknown', score: 1, reason: 'x' },
      { productId: 'known', score: 2, reason: 'bad' },
      { productId: 'known', score: -1, reason: 'bad' },
      { productId: 'known', score: 0, reason: 'first' },
      { productId: 'known', score: 1, reason: 'duplicate' },
    ] }),
  })
  assert.deepEqual(items, [{ productId: 'known', score: 0, reason: 'first' }])
})

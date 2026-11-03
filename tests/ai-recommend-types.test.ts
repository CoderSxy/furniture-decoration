import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { AiRecommendItem, AiRecommendRequest } from '../src/types/aiRecommend.ts'

test('AiRecommend types live outside domain.ts and match the design fields', () => {
  const domain = readFileSync('src/types/domain.ts', 'utf8')
  assert.equal(domain.includes('AiRecommend'), false)

  const req: AiRecommendRequest = {
    planId: 'plan-1',
    roomType: 'living',
    areaM2: 20,
    style: 'modern',
    budgetFen: 1600000,
    existingProductIds: ['p-sofa-modern-01'],
  }
  const item: AiRecommendItem = {
    productId: 'p-table-modern-06',
    score: 1,
    reason: '与当前方案风格一致，尺寸适合 20㎡ 客厅',
  }
  assert.equal(req.planId, 'plan-1')
  assert.equal(item.score, 1)
})

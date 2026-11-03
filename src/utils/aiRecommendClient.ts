import Taro from '@tarojs/taro'
import { recommendProducts } from '../mocks/aiRecommend'
import type { Product } from '../types/domain'
import type { AiRecommendItem, AiRecommendRequest } from '../types/aiRecommend'

export const AI_RECOMMEND_URL_ENV = 'TARO_APP_AI_RECOMMEND_URL'

export type AiRecommendRequestOptions = {
  url: string
  method: 'POST'
  data: AiRecommendRequest
}

export type FetchAiRecommendationsDeps = {
  products?: readonly Pick<Product, 'id'>[]
  getUrl?: () => string | undefined
  request?: (options: AiRecommendRequestOptions) => Promise<{ data: unknown; statusCode?: number }>
  recommend?: (req: AiRecommendRequest) => Promise<AiRecommendItem[]>
}

function readEnvUrl(): string | undefined {
  const value = process.env.TARO_APP_AI_RECOMMEND_URL
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export async function fetchAiRecommendations(
  req: AiRecommendRequest,
  deps: FetchAiRecommendationsDeps = {},
): Promise<AiRecommendItem[]> {
  const url = (deps.getUrl ?? readEnvUrl)()
  if (typeof url === 'string' && url.length > 0) {
    const request = deps.request ?? ((options: AiRecommendRequestOptions) => Taro.request(options))
    const res = await request({ url, method: 'POST', data: req })
    if (res.statusCode != null && (res.statusCode < 200 || res.statusCode >= 300)) {
      throw new Error(`Recommendation HTTP ${res.statusCode}`)
    }
    if (!Array.isArray(res.data)) throw new Error('Invalid recommendation response')
    return filterRecommendations(res.data, deps.products)
  }
  const recommend = deps.recommend ?? recommendProducts
  return filterRecommendations(await recommend(req), deps.products)
}

function isRecommendItem(value: unknown): value is AiRecommendItem {
  if (value == null || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.productId === 'string' && row.productId.trim().length > 0 &&
    typeof row.reason === 'string' && typeof row.score === 'number' && Number.isFinite(row.score) && row.score >= 0 && row.score <= 1
}

export function filterRecommendations(
  values: readonly unknown[],
  products?: readonly Pick<Product, 'id'>[],
): AiRecommendItem[] {
  const known = products ? new Set(products.map((p) => p.id)) : null
  const seen = new Set<string>()
  return values.filter((value): value is AiRecommendItem => {
    if (!isRecommendItem(value) || (known && !known.has(value.productId)) || seen.has(value.productId)) return false
    seen.add(value.productId)
    return true
  })
}

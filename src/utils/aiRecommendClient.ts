import Taro from '@tarojs/taro'
import { recommendProducts } from '../mocks/aiRecommend'
import type { AiRecommendItem, AiRecommendRequest } from '../types/aiRecommend'

export const AI_RECOMMEND_URL_ENV = 'TARO_APP_AI_RECOMMEND_URL'

export type AiRecommendRequestOptions = {
  url: string
  method: 'POST'
  data: AiRecommendRequest
}

export type FetchAiRecommendationsDeps = {
  getUrl?: () => string | undefined
  request?: (options: AiRecommendRequestOptions) => Promise<{ data: unknown }>
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
    return Array.isArray(res.data) ? (res.data as AiRecommendItem[]) : []
  }
  const recommend = deps.recommend ?? recommendProducts
  return recommend(req)
}

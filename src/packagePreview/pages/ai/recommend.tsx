import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ProductCard } from '../../../components/product-card'
import { EMPTY_AI_RECOMMEND_TEXT } from '../../../constants/labels'
import { useBudgetStore } from '../../../stores/budgetStore'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import type { AiRecommendItem } from '../../../types/aiRecommend'
import { fetchAiRecommendations, filterRecommendations } from '../../../utils/aiRecommendClient'
import { buildAiRecommendRequest } from '../../../utils/aiRecommendRequest'
import { useAuthGate } from '../../../hooks/useAuthGate'
import { previewPageUrl, productDetailUrl } from '../../../utils/navigation'
import './recommend.scss'

export default function AiRecommendPage() {
  useAuthGate()
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const products = useCatalogStore((state) => state.products)
  const addProductToPlan = usePlanStore((state) => state.addProductToPlan)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AiRecommendItem[]>([])

  useEffect(() => {
    if (!plan) {
      setLoading(false)
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    fetchAiRecommendations(buildAiRecommendRequest(plan, products), { products }).then((next) => {
      if (cancelled) return
      setItems(next)
    }).catch(() => {
      if (cancelled) return
      setItems([])
      setError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [planId, attempt])

  if (!plan) {
    return (
      <View className='page'>
        <Text className='ai-missing'>方案不存在</Text>
      </View>
    )
  }

  const displayItems = filterRecommendations(items, products)

  const onAdd = (productId: string) => {
    const result = addProductToPlan(plan.id, productId)
    if (result === 'added') {
      const next = selectPlanById(usePlanStore.getState(), plan.id)
      if (next) ensureForPlan(next, products)
      Taro.showToast({ title: '已加入方案', icon: 'success' })
      return
    }
    if (result === 'duplicate') {
      Taro.showToast({ title: '已在方案中', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Text className='ai-title'>AI 选品</Text>
      {loading ? <Text className='ai-status'>正在匹配家具…</Text> : null}
      {error ? <View onClick={() => setAttempt((value) => value + 1)}><Text>推荐失败，点击重试</Text></View> : null}
      {!loading && !error && displayItems.length === 0 ? (
        <Text className='ai-empty'>{EMPTY_AI_RECOMMEND_TEXT}</Text>
      ) : null}
      {!loading
        ? displayItems.map((item) => {
            const product = products.find((row) => row.id === item.productId)
            if (!product) return null
            const joined = plan.productIds.includes(item.productId)
            return (
              <View key={item.productId} className='ai-item'>
                <ProductCard
                  product={product}
                  onTap={(id) => {
                    Taro.navigateTo({ url: productDetailUrl(id) })
                  }}
                />
                <Text className='ai-item__reason'>{item.reason}</Text>
                <Text className='ai-item__score'>匹配 {item.score}</Text>
                <View
                  className={joined ? 'ai-item__add ai-item__add--ghost' : 'ai-item__add'}
                  onClick={() => onAdd(item.productId)}
                >
                  <Text className='ai-item__add-text'>{joined ? '已加入' : '加入方案'}</Text>
                </View>
              </View>
            )
          })
        : null}
      <View
        className='ai-preview'
        onClick={() => {
          Taro.navigateTo({ url: previewPageUrl(plan.id) })
        }}
      >
        <Text className='ai-preview__text'>去预览</Text>
      </View>
    </View>
  )
}

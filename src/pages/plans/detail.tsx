import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import { RoomFloorplan } from '../../components/room-floorplan'
import { ROOM_LABELS, SCAN_SOURCE_LABELS, STAGE_LABELS, STAGE_ORDER } from '../../constants/labels'
import { useBudgetStore } from '../../stores/budgetStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../stores/scanStore'
import type { Product } from '../../types/domain'
import { useAuthGate } from '../../hooks/useAuthGate'
import { aiRecommendUrl, previewPageUrl, productDetailUrl, scanPageUrl } from '../../utils/navigation'
import { advanceBlockedReason, canAdvanceStage, formatPlanArea } from '../../utils/plans'
import './detail.scss'

export default function PlanDetailPage() {
  useAuthGate()
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const removeProductFromPlan = usePlanStore((state) => state.removeProductFromPlan)
  const advanceStage = usePlanStore((state) => state.advanceStage)
  const products = useCatalogStore((state) => state.products)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='plan-missing'>方案不存在</Text>
      </View>
    )
  }

  const currentIndex = STAGE_ORDER.indexOf(plan.stage)
  const planProducts: Product[] = plan.productIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item): item is Product => item != null)
  const blocked = advanceBlockedReason(plan)
  const canAdvance = canAdvanceStage(plan)

  const onRemove = (productId: string) => {
    removeProductFromPlan(plan.id, productId)
    const next = selectPlanById(usePlanStore.getState(), plan.id)
    if (next) ensureForPlan(next, products)
  }

  return (
    <View className='page'>
      <Text className='plan-title'>{plan.title}</Text>
      <Text className='plan-meta'>
        {ROOM_LABELS[plan.roomType]} · {formatPlanArea(plan.areaM2)}
      </Text>
      <View className='plan-timeline'>
        {STAGE_ORDER.map((stage, index) => {
          const current = index === currentIndex
          const done = index < currentIndex
          const className = current
            ? 'plan-timeline__item plan-timeline__item--current'
            : done
              ? 'plan-timeline__item plan-timeline__item--done'
              : 'plan-timeline__item'
          return (
            <View key={stage} className={className}>
              <Text className='plan-timeline__text'>{STAGE_LABELS[stage]}</Text>
            </View>
          )
        })}
      </View>
      {plan.stage === 'measure' ? (
        <View
          className='plan-scan-entry'
          onClick={() => {
            Taro.navigateTo({ url: scanPageUrl(plan.id) })
          }}
        >
          <Text className='plan-scan-entry__text'>采集房型</Text>
        </View>
      ) : null}
      {scan ? (
        <View className='plan-scan'>
          <Text className='plan-section'>房型尺寸</Text>
          <Text className='plan-scan__size'>
            长 {scan.widthMm} × 宽 {scan.depthMm} × 高 {scan.heightMm} mm
          </Text>
          <Text className='plan-scan__source'>{SCAN_SOURCE_LABELS[scan.source]}</Text>
          <RoomFloorplan widthMm={scan.widthMm} depthMm={scan.depthMm} />
        </View>
      ) : null}
      <View
        className='plan-m5-entry'
        onClick={() => {
          Taro.navigateTo({ url: aiRecommendUrl(plan.id) })
        }}
      >
        <Text className='plan-m5-entry__text'>AI 选品</Text>
      </View>
      <View
        className='plan-m5-entry plan-m5-entry--ghost'
        onClick={() => {
          Taro.navigateTo({ url: previewPageUrl(plan.id) })
        }}
      >
        <Text className='plan-m5-entry__text'>预览</Text>
      </View>
      <Text className='plan-section'>已选商品</Text>
      {planProducts.length === 0 ? (
        <View
          className='plan-empty-products'
          onClick={() => {
            Taro.switchTab({ url: '/pages/catalog/index' })
          }}
        >
          <Text className='plan-empty-products__text'>还没有商品，去选品加入</Text>
        </View>
      ) : (
        planProducts.map((product) => (
          <View key={product.id} className='plan-product'>
            <ProductCard
              product={product}
              onTap={(id) => {
                Taro.navigateTo({ url: productDetailUrl(id) })
              }}
            />
            <View className='plan-product__remove' onClick={() => onRemove(product.id)}>
              <Text className='plan-product__remove-text'>移除</Text>
            </View>
          </View>
        ))
      )}
      {plan.stage === 'accept' ? (
        <Text className='plan-accept'>已验收</Text>
      ) : (
        <View>
          <View
            className={canAdvance ? 'plan-advance' : 'plan-advance plan-advance--disabled'}
            onClick={() => {
              if (!canAdvance) return
              advanceStage(plan.id)
            }}
          >
            <Text className='plan-advance__text'>推进到下一阶段</Text>
          </View>
          {blocked === '请先去选品' ? (
            <Text className='plan-advance__hint'>请先去选品</Text>
          ) : null}
        </View>
      )}
    </View>
  )
}

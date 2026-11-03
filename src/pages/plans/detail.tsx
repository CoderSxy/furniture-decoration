import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import { ROOM_LABELS, STAGE_LABELS, STAGE_ORDER } from '../../constants/labels'
import { useCatalogStore } from '../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../stores/planStore'
import type { Product } from '../../types/domain'
import { productDetailUrl } from '../../utils/navigation'
import { advanceBlockedReason, canAdvanceStage, formatPlanArea } from '../../utils/plans'
import './detail.scss'

export default function PlanDetailPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const removeProductFromPlan = usePlanStore((state) => state.removeProductFromPlan)
  const advanceStage = usePlanStore((state) => state.advanceStage)
  const products = useCatalogStore((state) => state.products)

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
            <View
              className='plan-product__remove'
              onClick={() => removeProductFromPlan(plan.id, product.id)}
            >
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

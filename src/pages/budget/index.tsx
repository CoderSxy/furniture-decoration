// src/pages/budget/index.tsx
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_CATEGORY_ORDER,
  STAGE_LABELS,
  STAGE_ORDER,
} from '../../constants/labels'
import { useBudgetStore } from '../../stores/budgetStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import { selectActivePlan, usePlanStore } from '../../stores/planStore'
import {
  buildBudget,
  countFavoritesNotInPlan,
  favoritesNotInPlanTip,
  isFurnitureOverspent,
  occupancyPercent,
  stageProgressPercent,
} from '../../utils/budget'
import { useAuthGate } from '../../hooks/useAuthGate'
import { formatPlanArea } from '../../utils/plans'
import { formatPriceYuan } from '../../utils/price'
import './index.scss'

export default function BudgetPage() {
  useAuthGate()
  const plan = usePlanStore(selectActivePlan)
  const products = useCatalogStore((state) => state.products)
  const favorites = useFavoriteStore((state) => state.items)

  useDidShow(() => {
    const active = selectActivePlan(usePlanStore.getState())
    if (active) {
      useBudgetStore.getState().ensureForPlan(active, useCatalogStore.getState().products)
    }
  })

  if (!plan) {
    return (
      <View className='page'>
        <View
          className='budget-empty'
          onClick={() => {
            Taro.switchTab({ url: '/pages/plans/index' })
          }}
        >
          <Text className='budget-empty__text'>还没有当前方案</Text>
          <Text className='budget-empty__action'>去方案看看</Text>
        </View>
      </View>
    )
  }

  const budget = buildBudget(plan, products)
  const overspent = isFurnitureOverspent(budget)
  const tip = favoritesNotInPlanTip(countFavoritesNotInPlan(favorites, plan.productIds))
  const stagePercent = stageProgressPercent(plan.stage)
  const currentIndex = STAGE_ORDER.indexOf(plan.stage)

  return (
    <View className='page'>
      <Text className='budget-title'>{plan.title}</Text>
      <Text className='budget-meta'>{formatPlanArea(plan.areaM2)}</Text>
      <View className='budget-total'>
        <Text className='budget-total__value'>{formatPriceYuan(budget.totalFen)}</Text>
        {overspent ? <Text className='budget-total__over'>已超支</Text> : null}
      </View>
      {BUDGET_CATEGORY_ORDER.map((category) => {
        const spent = budget.spentByCategory[category]
        const percent = occupancyPercent(spent, budget.totalFen)
        const over = category === 'furniture' && overspent
        return (
          <View key={category} className='budget-cat'>
            <View className='budget-cat__row'>
              <Text className='budget-cat__name'>{BUDGET_CATEGORY_LABELS[category]}</Text>
              <Text className={over ? 'budget-cat__amount budget-cat__amount--over' : 'budget-cat__amount'}>
                {formatPriceYuan(spent)}
              </Text>
            </View>
            <View className='budget-cat__track'>
              <View
                className={over ? 'budget-cat__fill budget-cat__fill--over' : 'budget-cat__fill'}
                style={{ width: `${percent}%` }}
              />
            </View>
          </View>
        )
      })}
      <Text className='budget-section'>阶段进度</Text>
      <View className='budget-stage-track'>
        <View className='budget-stage-fill' style={{ width: `${stagePercent}%` }} />
      </View>
      <View className='budget-stage-nodes'>
        {STAGE_ORDER.map((stage, index) => {
          const on = index <= currentIndex
          return (
            <View
              key={stage}
              className={on ? 'budget-stage-node budget-stage-node--on' : 'budget-stage-node'}
            >
              <Text className='budget-stage-node__text'>{STAGE_LABELS[stage]}</Text>
            </View>
          )
        })}
      </View>
      {tip ? (
        <View
          className='budget-tip'
          onClick={() => {
            Taro.switchTab({ url: '/pages/mine/index' })
          }}
        >
          <Text className='budget-tip__text'>{tip}</Text>
        </View>
      ) : null}
    </View>
  )
}

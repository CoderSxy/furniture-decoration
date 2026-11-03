import { View, Text } from '@tarojs/components'
import { useBudgetStore } from '../../stores/budgetStore'
import { TAB_ITEMS } from '../../constants/tabs'
import './index.scss'

const META = TAB_ITEMS[2]

export default function BudgetPage() {
  const budgetCount = useBudgetStore((s) => Object.keys(s.budgets).length)

  return (
    <View className='page'>
      <Text className='page__title'>{META.text}</Text>
      <Text className='page__duty'>{META.duty}</Text>
      <Text className='page__meta'>预算 {budgetCount} 份</Text>
    </View>
  )
}

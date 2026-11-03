import { View, Text } from '@tarojs/components'
import { usePlanStore } from '../../stores/planStore'
import { TAB_ITEMS } from '../../constants/tabs'
import './index.scss'

const META = TAB_ITEMS[1]

export default function PlansPage() {
  const planCount = usePlanStore((s) => s.plans.length)

  return (
    <View className='page'>
      <Text className='page__title'>{META.text}</Text>
      <Text className='page__duty'>{META.duty}</Text>
      <Text className='page__meta'>方案 {planCount} 条</Text>
    </View>
  )
}

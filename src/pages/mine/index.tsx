import { View, Text } from '@tarojs/components'
import { useFavoriteStore } from '../../stores/favoriteStore'
import { TAB_ITEMS } from '../../constants/tabs'
import './index.scss'

const META = TAB_ITEMS[3]

export default function MinePage() {
  const favoriteCount = useFavoriteStore((s) => s.items.length)

  return (
    <View className='page'>
      <Text className='page__title'>{META.text}</Text>
      <Text className='page__duty'>{META.duty}</Text>
      <Text className='page__meta'>收藏 {favoriteCount} 件</Text>
    </View>
  )
}

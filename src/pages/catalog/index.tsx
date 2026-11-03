import { View, Text } from '@tarojs/components'
import { useCatalogStore } from '../../stores/catalogStore'
import { useUiStore } from '../../stores/uiStore'
import { TAB_ITEMS } from '../../constants/tabs'
import './index.scss'

const META = TAB_ITEMS[0]

export default function CatalogPage() {
  const productCount = useCatalogStore((s) => s.products.length)
  const filterPanelOpen = useUiStore((s) => s.filterPanelOpen)

  return (
    <View className='page'>
      <Text className='page__title'>{META.text}</Text>
      <Text className='page__duty'>{META.duty}</Text>
      <Text className='page__meta'>商品 {productCount} 件 · 筛选面板 {filterPanelOpen ? '开' : '关'}</Text>
    </View>
  )
}

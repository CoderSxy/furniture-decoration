import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useShallow } from 'zustand/react/shallow'
import { FilterBar } from '../../components/filter-bar'
import { ProductCard } from '../../components/product-card'
import { selectFilteredProducts, useCatalogStore } from '../../stores/catalogStore'
import { useUiStore } from '../../stores/uiStore'
import { summarizeFilters } from '../../utils/filterProducts'
import { productDetailUrl } from '../../utils/navigation'
import './index.scss'

export default function CatalogPage() {
  const filters = useCatalogStore((state) => state.filters)
  const setFilters = useCatalogStore((state) => state.setFilters)
  const clearFilters = useCatalogStore((state) => state.clearFilters)
  const products = useCatalogStore(useShallow(selectFilteredProducts))
  const filterPanelOpen = useUiStore((state) => state.filterPanelOpen)
  const setFilterPanelOpen = useUiStore((state) => state.setFilterPanelOpen)

  return (
    <View className='page'>
      <View
        className='catalog-toolbar'
        onClick={() => setFilterPanelOpen(!filterPanelOpen)}
      >
        <Text className='catalog-toolbar__label'>筛选</Text>
        <Text className='catalog-toolbar__value'>{summarizeFilters(filters)}</Text>
        <Text className='catalog-toolbar__action'>{filterPanelOpen ? '收起' : '展开'}</Text>
      </View>
      {filterPanelOpen ? (
        <FilterBar filters={filters} onChange={setFilters} onClear={clearFilters} />
      ) : null}
      <Text className='catalog-count'>共 {products.length} 件</Text>
      {products.length === 0 ? (
        <View className='catalog-empty'>
          <Text className='catalog-empty__text'>暂无符合条件的商品</Text>
          <Text className='catalog-empty__action' onClick={clearFilters}>
            清空筛选
          </Text>
        </View>
      ) : (
        products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onTap={(productId) => {
              Taro.navigateTo({ url: productDetailUrl(productId) })
            }}
          />
        ))
      )}
    </View>
  )
}

import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import type { Product } from '../../types/domain'
import { productDetailUrl } from '../../utils/navigation'
import './index.scss'

export default function MinePage() {
  const items = useFavoriteStore((state) => state.items)
  const products = useCatalogStore((state) => state.products)
  const favoriteProducts: Product[] = [...items]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((record) => products.find((product) => product.id === record.productId))
    .filter((product): product is Product => product != null)

  return (
    <View className='page'>
      <Text className='page__title'>收藏</Text>
      {favoriteProducts.length === 0 ? (
        <View
          className='mine-empty'
          onClick={() => {
            Taro.switchTab({ url: '/pages/catalog/index' })
          }}
        >
          <Text className='mine-empty__text'>还没有收藏，去选品看看</Text>
        </View>
      ) : (
        favoriteProducts.map((product) => (
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

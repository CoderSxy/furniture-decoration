import { Image, Text, View } from '@tarojs/components'
import { CATEGORY_LABELS, STYLE_LABELS } from '../../constants/labels'
import type { Product } from '../../types/domain'
import { formatPriceYuan } from '../../utils/price'
import './index.scss'

export type ProductCardProps = {
  product: Product
  onTap: (productId: string) => void
}

export function ProductCard({ product, onTap }: ProductCardProps) {
  return (
    <View className='product-card' onClick={() => onTap(product.id)}>
      <Image className='product-card__cover' src={product.coverUrl} mode='aspectFill' />
      <Text className='product-card__name'>{product.name}</Text>
      <Text className='product-card__meta'>
        {CATEGORY_LABELS[product.category]} · {STYLE_LABELS[product.style]}
      </Text>
      <Text className='product-card__price'>{formatPriceYuan(product.priceFen)}</Text>
    </View>
  )
}

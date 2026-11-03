import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { CATEGORY_LABELS, ROOM_LABELS, STYLE_LABELS } from '../../constants/labels'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import { formatPriceYuan } from '../../utils/price'
import './detail.scss'

export default function CatalogDetailPage() {
  const router = useRouter()
  const productId = router.params.productId ?? ''
  const product = useCatalogStore((state) =>
    state.products.find((item) => item.id === productId),
  )
  const favorited = useFavoriteStore((state) =>
    state.items.some((item) => item.productId === productId),
  )
  const toggleFavorite = useFavoriteStore((state) => state.toggleFavorite)

  if (!product) {
    return (
      <View className='page'>
        <Text className='detail-missing'>商品不存在</Text>
      </View>
    )
  }

  const gallery = product.imageUrls.length > 0 ? product.imageUrls : [product.coverUrl]
  const roomText = product.rooms.map((room) => ROOM_LABELS[room]).join(' / ')

  return (
    <View className='page'>
      <Swiper className='detail-swiper' indicatorDots circular autoplay={false}>
        {gallery.map((src) => (
          <SwiperItem key={src}>
            <Image className='detail-swiper__image' src={src} mode='aspectFill' />
          </SwiperItem>
        ))}
      </Swiper>
      <Text className='detail-name'>{product.name}</Text>
      <Text className='detail-meta'>
        {CATEGORY_LABELS[product.category]} · {STYLE_LABELS[product.style]} · {roomText}
      </Text>
      <Text className='detail-price'>{formatPriceYuan(product.priceFen)}</Text>
      <Text className='detail-row'>
        尺寸 {product.sizeMm.w} × {product.sizeMm.d} × {product.sizeMm.h} mm
      </Text>
      <Text className='detail-row'>材质 {product.material}</Text>
      <Text className='detail-desc'>{product.description}</Text>
      <View className='detail-fav' onClick={() => toggleFavorite(product.id)}>
        <Text className='detail-fav__text'>{favorited ? '已收藏' : '收藏'}</Text>
      </View>
    </View>
  )
}

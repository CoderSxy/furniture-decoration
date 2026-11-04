// src/pages/catalog/detail.tsx
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { CATEGORY_LABELS, ROOM_LABELS, STYLE_LABELS } from '../../constants/labels'
import { useBudgetStore } from '../../stores/budgetStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import { selectActivePlan, usePlanStore } from '../../stores/planStore'
import { useAuthGate } from '../../hooks/useAuthGate'
import { formatPriceYuan } from '../../utils/price'
import './detail.scss'

export default function CatalogDetailPage() {
  useAuthGate()
  const router = useRouter()
  const productId = router.params.productId ?? ''
  const product = useCatalogStore((state) =>
    state.products.find((item) => item.id === productId),
  )
  const products = useCatalogStore((state) => state.products)
  const favorited = useFavoriteStore((state) =>
    state.items.some((item) => item.productId === productId),
  )
  const toggleFavorite = useFavoriteStore((state) => state.toggleFavorite)
  const activePlanId = usePlanStore((state) => state.activePlanId)
  const addProductToActivePlan = usePlanStore((state) => state.addProductToActivePlan)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)

  if (!product) {
    return (
      <View className='page'>
        <Text className='detail-missing'>商品不存在</Text>
      </View>
    )
  }

  const gallery = product.imageUrls.length > 0 ? product.imageUrls : [product.coverUrl]
  const roomText = product.rooms.map((room) => ROOM_LABELS[room]).join(' / ')

  const onAddToPlan = () => {
    if (activePlanId == null) {
      Taro.switchTab({ url: '/pages/plans/index' })
      return
    }
    const result = addProductToActivePlan(product.id)
    if (result === 'added') {
      const active = selectActivePlan(usePlanStore.getState())
      if (active) ensureForPlan(active, products)
      Taro.showToast({ title: '已加入当前方案', icon: 'success' })
    } else if (result === 'duplicate') {
      Taro.showToast({ title: '已在当前方案中', icon: 'none' })
    }
  }

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
      <View
        className={activePlanId == null ? 'detail-plan detail-plan--ghost' : 'detail-plan'}
        onClick={onAddToPlan}
      >
        <Text
          className={
            activePlanId == null ? 'detail-plan__text detail-plan__text--ghost' : 'detail-plan__text'
          }
        >
          {activePlanId == null ? '请先新建方案' : '加入当前方案'}
        </Text>
      </View>
    </View>
  )
}

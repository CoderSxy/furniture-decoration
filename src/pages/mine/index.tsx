// src/pages/mine/index.tsx
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import type { Product } from '../../types/domain'
import { productDetailUrl } from '../../utils/navigation'
import { retryFailedStorageWrites } from '../../utils/storage'
import { resetMockData } from '../../utils/resetMock'
import './index.scss'

export default function MinePage() {
  const items = useFavoriteStore((state) => state.items)
  const products = useCatalogStore((state) => state.products)
  const favoriteProducts: Product[] = [...items]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((record) => products.find((product) => product.id === record.productId))
    .filter((product): product is Product => product != null)

  const onReset = async () => {
    const result = await Taro.showModal({
      title: '重置 mock',
      content: '将清除收藏、方案、预算和扫描，商品列表不受影响。',
      confirmText: '重置',
      cancelText: '取消',
    })
    if (!result.confirm) return
    const reset = resetMockData()
    Taro.showToast({ title: reset.ok ? '已重置' : '部分未保存，请重试保存', icon: 'none' })
  }

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
      <View onClick={() => {
        const results = retryFailedStorageWrites()
        Taro.showToast({ title: results.every((row) => row.ok) ? '保存完成' : '保存失败，请稍后重试', icon: 'none' })
      }}><Text>重试本机保存</Text></View>
      <Text className='mine-note'>数据仅保存在本机。不含账号、支付或云端备份。</Text>
      <View className='mine-reset' onClick={() => {
        void Taro.showModal({
          title: '隐私与本地保存说明',
          content: '相机用于房型测量，参考照片由你主动选择。收藏、方案、预算、房型尺寸及照片路径仅保存在本机；临时照片可能失效，清理应用数据会丢失记录。默认 AI 使用本地 mock；若配置远程推荐，将向该接口发送房型、面积、风格、预算和已选商品 ID，不发送照片。可通过“重置 mock”清除本地记录。',
          showCancel: false,
        })
      }}><Text>隐私与本地保存说明</Text></View>
      <View className='mine-reset' onClick={() => { void onReset() }}>
        <Text className='mine-reset__text'>重置 mock</Text>
      </View>
    </View>
  )
}

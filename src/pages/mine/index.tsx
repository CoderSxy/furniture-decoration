// src/pages/mine/index.tsx
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ProductCard } from '../../components/product-card'
import {
  CLEAR_MY_DATA_CONFIRM_CONTENT,
  CLEAR_MY_DATA_TEXT,
  LOGIN_REQUIRED_TEXT,
  LOGOUT_BUTTON_TEXT,
  MINE_NOTE_TEXT,
  MINE_PRIVACY_MODAL_TEXT,
} from '../../constants/labels'
import { useAuthGate } from '../../hooks/useAuthGate'
import { useCatalogStore } from '../../stores/catalogStore'
import { useFavoriteStore } from '../../stores/favoriteStore'
import { useSyncStore } from '../../stores/syncStore'
import type { Product } from '../../types/domain'
import { isLoggedIn } from '../../utils/authGate'
import { logoutSession } from '../../utils/authSession'
import { loginPageUrl, productDetailUrl } from '../../utils/navigation'
import { clearMyDataCloud } from '../../utils/resetMock'
import { retryFailedStorageWrites } from '../../utils/storage'
import './index.scss'

export default function MinePage() {
  useAuthGate()
  const token = useSyncStore((state) => state.token)
  const loggedIn = typeof token === 'string' && token.length > 0
  const items = useFavoriteStore((state) => state.items)
  const products = useCatalogStore((state) => state.products)
  const favoriteProducts: Product[] = [...items]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((record) => products.find((product) => product.id === record.productId))
    .filter((product): product is Product => product != null)

  const onLogout = () => {
    void (async () => {
      await logoutSession()
      Taro.reLaunch({ url: loginPageUrl() })
    })()
  }

  const onClear = () => {
    if (!isLoggedIn()) {
      Taro.showToast({ title: LOGIN_REQUIRED_TEXT, icon: 'none' })
      return
    }
    void (async () => {
      const result = await Taro.showModal({
        title: CLEAR_MY_DATA_TEXT,
        content: CLEAR_MY_DATA_CONFIRM_CONTENT,
        confirmText: '清除',
        cancelText: '取消',
      })
      if (!result.confirm) return
      await clearMyDataCloud()
    })()
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
      <Text className='mine-note'>{MINE_NOTE_TEXT}</Text>
      <View
        className='mine-reset'
        onClick={() => {
          void Taro.showModal({
            title: '隐私与本地保存说明',
            content: MINE_PRIVACY_MODAL_TEXT,
            showCancel: false,
          })
        }}
      >
        <Text>隐私与本地保存说明</Text>
      </View>
      <View className='mine-reset' onClick={onLogout}>
        <Text className='mine-reset__text'>{LOGOUT_BUTTON_TEXT}</Text>
      </View>
      <View
        className={loggedIn ? 'mine-reset' : 'mine-reset mine-reset--disabled'}
        onClick={onClear}
      >
        <Text className='mine-reset__text'>{CLEAR_MY_DATA_TEXT}</Text>
      </View>
      <View onClick={() => {
        const results = retryFailedStorageWrites()
        Taro.showToast({ title: results.every((row) => row.ok) ? '保存完成' : '保存失败，请稍后重试', icon: 'none' })
      }}><Text>重试本机保存</Text></View>
    </View>
  )
}

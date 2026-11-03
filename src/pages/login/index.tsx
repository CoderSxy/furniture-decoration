import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  LOGIN_BUTTON_TEXT,
  LOGIN_MISSING_BASE_TEXT,
  LOGIN_SUBTITLE,
} from '../../constants/labels'
import { isLoggedIn } from '../../utils/authGate'
import { getApiBaseUrl } from '../../utils/apiClient'
import { loginWithWeChat } from '../../utils/authSession'
import { runLoginSync } from '../../utils/syncEngine'
import './index.scss'

export default function LoginPage() {
  useDidShow(() => {
    if (isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/catalog/index' })
    }
  })

  const onLogin = () => {
    if (!getApiBaseUrl()) {
      Taro.showToast({ title: LOGIN_MISSING_BASE_TEXT, icon: 'none' })
      return
    }
    void (async () => {
      try {
        await loginWithWeChat()
        try {
          await runLoginSync()
        } catch {
          // 同步失败仍进入选品，由 pendingRetry 稍后重试
        }
        Taro.reLaunch({ url: '/pages/catalog/index' })
      } catch {
        // 登录失败留在登录页
      }
    })()
  }

  return (
    <View className='page'>
      <Text className='login-title'>家具装修</Text>
      <Text className='login-sub'>{LOGIN_SUBTITLE}</Text>
      <View className='login-btn' onClick={onLogin}>
        <Text className='login-btn__text'>{LOGIN_BUTTON_TEXT}</Text>
      </View>
    </View>
  )
}

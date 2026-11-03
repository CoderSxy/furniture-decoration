import { useDidShow } from '@tarojs/taro'
import { guardAuthenticatedPage } from '../utils/authGate'

export function useAuthGate(): void {
  useDidShow(() => {
    guardAuthenticatedPage()
  })
}

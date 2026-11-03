import { Text, View } from '@tarojs/components'
import Taro, { useDidHide, useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import type { ProbeResult } from '../../../utils/scanCapability'
import { createScanCancellation, prepareScanSession, releaseScanSession } from '../../../utils/scanCapability'
import {
  createWeappPrivacyBridge,
  getCreateVkSession,
  readSdkVersion,
} from '../../../utils/weappScanBridge'
import { useAuthGate } from '../../../hooks/useAuthGate'
import { ManualForm } from './manual-form'
import { MeasureView } from './measure-view'
import './index.scss'

export default function ScanPage() {
  useAuthGate()
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const [mode, setMode] = useState<'loading' | 'manual' | 'visionkit'>('loading')
  const [session, setSession] = useState<ProbeResult['session']>(null)

  const cancelRef = useRef<() => void>(() => {})

  // Returning from background keeps manual mode; re-enter the page to scan again.
  useDidHide(() => cancelRef.current())

  useEffect(() => {
    if (!planId) return
    const controller = createScanCancellation()
    let active: ProbeResult['session'] = null
    cancelRef.current = () => {
      controller.abort()
      releaseScanSession(active)
      setSession(null)
      setMode('manual')
    }
    const run = async () => {
      const result = await prepareScanSession({
        getSdkVersion: readSdkVersion,
        createVKSession: getCreateVkSession(),
        privacy: createWeappPrivacyBridge(),
        signal: controller.signal,
      })
      active = result.session
      if (controller.signal.aborted) {
        releaseScanSession(active)
        return
      }
      setSession(active)
      setMode(active ? 'visionkit' : 'manual')
    }
    void run().catch(() => {
      if (!controller.signal.aborted) setMode('manual')
    })
    return () => {
      controller.abort()
      releaseScanSession(active)
    }
  }, [planId])

  if (!planId) {
    return (
      <View className='page'>
        <Text className='page__title'>缺少方案，无法采集</Text>
      </View>
    )
  }

  if (mode === 'loading') {
    return (
      <View className='page'>
        <Text className='page__duty'>正在检测测量能力</Text>
        <View onClick={() => cancelRef.current()}><Text>改用手填</Text></View>
      </View>
    )
  }

  if (mode === 'visionkit' && session) {
    return (
      <View className='page page--measure'>
        <MeasureView
          planId={planId}
          session={session}
          onSaved={() => {
            releaseScanSession(session)
            Taro.navigateBack()
          }}
          onFallback={() => cancelRef.current()}
        />
      </View>
    )
  }

  return (
    <View className='page'>
      <Text>相机停止或离开页面后改用手填；重新进入可再次测量。</Text>
      <ManualForm
        planId={planId}
        onSaved={() => {
          Taro.navigateBack()
        }}
      />
    </View>
  )
}

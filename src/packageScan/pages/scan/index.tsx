import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { ProbeResult } from '../../../utils/scanCapability'
import { probeScanCapability } from '../../../utils/scanCapability'
import { ensureCameraPrivacy } from '../../../utils/scanPrivacy'
import {
  createWeappPrivacyBridge,
  getCreateVkSession,
  readSdkVersion,
} from '../../../utils/weappScanBridge'
import { ManualForm } from './manual-form'
import { MeasureView } from './measure-view'
import './index.scss'

export default function ScanPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const [mode, setMode] = useState<'loading' | 'manual' | 'visionkit'>('loading')
  const [session, setSession] = useState<ProbeResult['session']>(null)

  useEffect(() => {
    if (!planId) return
    let cancelled = false
    let active: ProbeResult['session'] = null
    const run = async () => {
      const result = await probeScanCapability({
        getSdkVersion: readSdkVersion,
        createVKSession: getCreateVkSession(),
      })
      active = result.session
      if (cancelled) {
        active?.destroy()
        return
      }
      if (result.capability !== 'visionkit-v2' || result.session == null) {
        setMode('manual')
        return
      }
      const allowed = await ensureCameraPrivacy(createWeappPrivacyBridge())
      if (cancelled) {
        result.session.destroy()
        return
      }
      if (!allowed) {
        result.session.destroy()
        active = null
        setMode('manual')
        return
      }
      setSession(result.session)
      setMode('visionkit')
    }
    void run()
    return () => {
      cancelled = true
      active?.destroy()
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
            session.destroy()
            Taro.navigateBack()
          }}
          onFallback={() => {
            session.destroy()
            setSession(null)
            setMode('manual')
          }}
        />
      </View>
    )
  }

  return (
    <View className='page'>
      <ManualForm
        planId={planId}
        onSaved={() => {
          Taro.navigateBack()
        }}
      />
    </View>
  )
}

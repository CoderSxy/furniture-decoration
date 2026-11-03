import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { ProbeResult } from '../../../utils/scanCapability'
import { probeScanCapability } from '../../../utils/scanCapability'
import { getCreateVkSession, readSdkVersion } from '../../../utils/weappScanBridge'
import { ManualForm } from './manual-form'
import './index.scss'

export default function ScanPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const [probe, setProbe] = useState<ProbeResult | null>(null)

  useEffect(() => {
    if (!planId) return
    let cancelled = false
    let session: ProbeResult['session'] = null
    void probeScanCapability({
      getSdkVersion: readSdkVersion,
      createVKSession: getCreateVkSession(),
    }).then((result) => {
      session = result.session
      if (cancelled) {
        session?.destroy()
        return
      }
      setProbe(result)
    })
    return () => {
      cancelled = true
      session?.destroy()
    }
  }, [planId])

  if (!planId) {
    return (
      <View className='page'>
        <Text className='page__title'>缺少方案，无法采集</Text>
      </View>
    )
  }

  if (probe == null) {
    return (
      <View className='page'>
        <Text className='page__duty'>正在检测测量能力</Text>
      </View>
    )
  }

  if (probe.capability === 'visionkit-v2') {
    return (
      <View className='page'>
        <Text className='page__title'>VisionKit 测量准备中</Text>
        <Text className='page__duty'>请使用真机预览。开发者工具可返回并改用手填。</Text>
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

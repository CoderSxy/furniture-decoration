import { View, Text } from '@tarojs/components'
import { useScanStore } from '../../../stores/scanStore'
import './index.scss'

export default function ScanPlaceholderPage() {
  const scanCount = useScanStore((s) => Object.keys(s.scans).length)

  return (
    <View className='page'>
      <Text className='page__title'>房型扫描</Text>
      <Text className='page__duty'>M4 占位页。当前不采集摄像头数据。</Text>
      <Text className='page__meta'>已存扫描 {scanCount} 条</Text>
    </View>
  )
}

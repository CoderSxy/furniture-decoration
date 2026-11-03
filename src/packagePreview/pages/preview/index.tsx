import { View, Text } from '@tarojs/components'
import './index.scss'

export default function PreviewPlaceholderPage() {
  return (
    <View className='page'>
      <Text className='page__title'>预览</Text>
      <Text className='page__duty'>M5 占位页。当前不加载 3D 资源。</Text>
    </View>
  )
}

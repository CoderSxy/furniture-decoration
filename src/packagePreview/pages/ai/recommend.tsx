import { View, Text } from '@tarojs/components'
import './recommend.scss'

export default function AiRecommendPlaceholderPage() {
  return (
    <View className='page'>
      <Text className='page__title'>AI 选品</Text>
      <Text className='page__duty'>M5 占位页。当前不调用模型。</Text>
    </View>
  )
}

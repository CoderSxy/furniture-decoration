import { Text, View } from '@tarojs/components'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { fitFloorplanSize } from '../../utils/floorplan'
import './index.scss'

export type RoomFloorplanProps = {
  widthMm: number
  depthMm: number
}

export function RoomFloorplan({ widthMm, depthMm }: RoomFloorplanProps) {
  const container = useContainerWidth()
  const size = fitFloorplanSize(widthMm, depthMm, container.width, container.width * 0.6)
  return (
    <View className='floorplan' id={container.id}>
      {container.width === 0 ? <Text onClick={container.remeasure}>画布尚未就绪，点击重试</Text> : null}
      <View className='floorplan__rect' style={{ width: `${size.width}px`, height: `${size.height}px` }} />
    </View>
  )
}

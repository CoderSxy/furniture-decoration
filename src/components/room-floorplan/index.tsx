import { View } from '@tarojs/components'
import { fitFloorplanSize } from '../../utils/floorplan'
import './index.scss'

export type RoomFloorplanProps = {
  widthMm: number
  depthMm: number
}

export function RoomFloorplan({ widthMm, depthMm }: RoomFloorplanProps) {
  const size = fitFloorplanSize(widthMm, depthMm, 400, 240)
  if (size.width === 0 || size.height === 0) return null
  return (
    <View className='floorplan'>
      <View className='floorplan__rect' style={{ width: `${size.width}px`, height: `${size.height}px` }} />
    </View>
  )
}

import { Text, View } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../../../types/domain'
import { fitFloorplanSize } from '../../../utils/floorplan'
import {
  layoutFurniture,
  moveFurniture,
  type PlacedFurniture,
  type PreviewRoomMm,
} from '../../../utils/previewLayout'
import './index.scss'

export type PreviewFloor2dProps = {
  room: PreviewRoomMm
  products: readonly Product[]
}

type DragState = {
  productId: string
  startPageX: number
  startPageY: number
  origXMm: number
  origYMm: number
}

export function PreviewFloor2d({ room, products }: PreviewFloor2dProps) {
  const auto = useMemo(() => layoutFurniture(room, products), [room, products])
  const [placed, setPlaced] = useState<PlacedFurniture[]>(auto)
  const dragRef = useRef<DragState | null>(null)
  const box = fitFloorplanSize(room.widthMm, room.depthMm, 670, 480)
  const pxPerMm = box.width > 0 ? box.width / room.widthMm : 0

  useEffect(() => {
    setPlaced(auto)
    dragRef.current = null
  }, [auto])

  if (box.width === 0 || box.height === 0) return null

  const onTouchStart = (productId: string, pageX: number, pageY: number) => {
    const current = placed.find((item) => item.productId === productId)
    if (!current) return
    dragRef.current = {
      productId,
      startPageX: pageX,
      startPageY: pageY,
      origXMm: current.xMm,
      origYMm: current.yMm,
    }
  }

  const onTouchMove = (pageX: number, pageY: number) => {
    const drag = dragRef.current
    if (!drag || pxPerMm <= 0) return
    const xMm = drag.origXMm + (pageX - drag.startPageX) / pxPerMm
    const yMm = drag.origYMm + (pageY - drag.startPageY) / pxPerMm
    setPlaced((current) => moveFurniture(current, drag.productId, xMm, yMm, room))
  }

  return (
    <View className='preview2d'>
      <Text className='preview2d__hint'>
        俯视 {room.widthMm} × {room.depthMm} mm，拖动不保存
      </Text>
      <View
        className='preview2d__room'
        style={{ width: `${box.width}px`, height: `${box.height}px` }}
      >
        {placed.map((item) => (
          <View
            key={item.productId}
            className='preview2d__item'
            style={{
              left: `${item.xMm * pxPerMm}px`,
              top: `${item.yMm * pxPerMm}px`,
              width: `${item.wMm * pxPerMm}px`,
              height: `${item.dMm * pxPerMm}px`,
            }}
            onTouchStart={(event) => {
              const touch = (event as ITouchEvent).touches[0]
              if (!touch) return
              onTouchStart(item.productId, touch.pageX, touch.pageY)
            }}
            onTouchMove={(event) => {
              const touch = (event as ITouchEvent).touches[0]
              if (!touch) return
              onTouchMove(touch.pageX, touch.pageY)
            }}
            onTouchEnd={() => {
              dragRef.current = null
            }}
          >
            <Text className='preview2d__item-label'>
              {products.find((row) => row.id === item.productId)?.name ?? item.productId}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

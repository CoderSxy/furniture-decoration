import { Camera, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useScanStore } from '../../../stores/scanStore'
import type { VkSessionHandle } from '../../../types/vk'
import {
  applyHit,
  buildVisionKitScan,
  canSaveMeasure,
  createMeasureState,
  DEFAULT_ROOM_HEIGHT_MM,
  measureHint,
  normalizePageTap,
  parsePositiveMm,
} from '../../../utils/scanMeasure'

export type MeasureViewProps = {
  planId: string
  session: VkSessionHandle
  onSaved: () => void
  onFallback: () => void
}

export function MeasureView({ planId, session, onSaved, onFallback }: MeasureViewProps) {
  const upsert = useScanStore((state) => state.upsert)
  const [state, setState] = useState(() => createMeasureState())
  const [heightText, setHeightText] = useState(String(DEFAULT_ROOM_HEIGHT_MM))

  const onTap = (event: {
    detail?: { x?: number; y?: number }
    changedTouches?: Array<{ pageX?: number; clientX?: number; pageY?: number; clientY?: number }>
  }) => {
    const touch = event.changedTouches?.[0]
    const pageX = touch?.pageX ?? touch?.clientX ?? event.detail?.x
    const pageY = touch?.pageY ?? touch?.clientY ?? event.detail?.y
    if (pageX == null || pageY == null) return
    Taro.createSelectorQuery()
      .select('.scan-stage')
      .boundingClientRect()
      .exec((res) => {
        const rect = res?.[0] as { left: number; top: number; width: number; height: number } | undefined
        if (!rect) return
        const tap = normalizePageTap(pageX, pageY, rect)
        if (!tap) return
        const hits = session.hitTest(tap.x, tap.y)
        const transform = hits[0]?.transform
        if (!transform) {
          Taro.showToast({ title: '未识别到地面，请对准地面再点', icon: 'none' })
          return
        }
        setState((current) => {
          const next = applyHit(current, transform)
          if (next.error === 'no-distance') {
            Taro.showToast({ title: '未识别到地面，请对准地面再点', icon: 'none' })
            return current
          }
          return next.state
        })
      })
  }

  const save = () => {
    const heightMm = parsePositiveMm(heightText)
    if (heightMm == null) {
      Taro.showToast({ title: '层高必须大于 0', icon: 'none' })
      return
    }
    const ready = { ...state, heightMm }
    if (!canSaveMeasure(ready) || ready.widthMm == null || ready.depthMm == null) {
      Taro.showToast({ title: '请先点完地面两对点', icon: 'none' })
      return
    }
    upsert(
      buildVisionKitScan({
        planId,
        widthMm: ready.widthMm,
        depthMm: ready.depthMm,
        heightMm,
        capturedAt: new Date().toISOString(),
      }),
    )
    Taro.showToast({ title: '已保存房型', icon: 'success' })
    onSaved()
  }

  return (
    <View className='measure'>
      <View className='scan-stage' onClick={(event) => onTap(event)}>
        <Camera
          className='scan-camera'
          devicePosition='back'
          flash='off'
          onError={() => onFallback()}
        />
        <View className='scan-hit' />
      </View>
      <Text className='measure__hint'>{measureHint(state.phase)}</Text>
      <Text className='measure__meta'>
        请将手机对准地面并左右平移完成初始化。长度 {state.widthMm ?? '—'} mm · 宽度{' '}
        {state.depthMm ?? '—'} mm
      </Text>
      <Input
        className='manual__input'
        type='number'
        value={heightText}
        placeholder='层高（mm）'
        onInput={(event) => {
          const next = event.detail.value
          setHeightText(next)
          const heightMm = parsePositiveMm(next) ?? DEFAULT_ROOM_HEIGHT_MM
          setState((current) => ({ ...current, heightMm }))
        }}
      />
      <View className='manual__submit' onClick={save}>
        <Text className='manual__submit-text'>保存测量</Text>
      </View>
      <View className='manual__secondary' onClick={onFallback}>
        <Text className='manual__secondary-text'>改用手填</Text>
      </View>
    </View>
  )
}

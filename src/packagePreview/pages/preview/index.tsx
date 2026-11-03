import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { PreviewFloor2d } from '../../components/preview-2d'
import { XR_FRAME_UNSUPPORTED_TEXT } from '../../../constants/labels'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../../stores/scanStore'
import type { Product } from '../../../types/domain'
import {
  furnitureToXrCubes,
  layoutFurniture,
  resolvePreviewRoom,
  roomFloorScale,
} from '../../../utils/previewLayout'
import { useAuthGate } from '../../../hooks/useAuthGate'
import { readXrFrameSupport } from '../../../utils/xrCapability'
import './index.scss'

type PreviewMode = '2d' | '3d'

export default function PreviewPage() {
  useAuthGate()
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const products = useCatalogStore((state) => state.products)
  const [canUse3d, setCanUse3d] = useState(() => readXrFrameSupport())
  const [mode, setMode] = useState<PreviewMode>('2d')
  const readyRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const fallback = () => {
    clearTimeout(timeoutRef.current)
    setCanUse3d(false)
    setMode('2d')
  }
  useEffect(() => {
    if (mode !== '3d' || !canUse3d) return
    timeoutRef.current = setTimeout(() => {
      if (!readyRef.current) fallback()
    }, 8000)
    return () => clearTimeout(timeoutRef.current)
  }, [mode, canUse3d])


  const room = resolvePreviewRoom(scan)
  const planProducts: Product[] = useMemo(() => {
    if (!plan) return []
    return plan.productIds
      .map((id) => products.find((item) => item.id === id))
      .filter((item): item is Product => item != null)
  }, [plan, products])
  const cubesJson = JSON.stringify(furnitureToXrCubes(room, layoutFurniture(room, planProducts)))
  const floorScale = roomFloorScale(room)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='preview-missing'>方案不存在</Text>
      </View>
    )
  }

  return (
    <View className='page'>
      <Text className='preview-title'>预览</Text>
      {canUse3d ? (
        <View className='preview-switch'>
          <View
            className={mode === '2d' ? 'preview-switch__btn preview-switch__btn--on' : 'preview-switch__btn'}
            onClick={() => setMode('2d')}
          >
            <Text className='preview-switch__text'>2D</Text>
          </View>
          <View
            className={mode === '3d' ? 'preview-switch__btn preview-switch__btn--on' : 'preview-switch__btn'}
            onClick={() => { readyRef.current = false; setMode('3d') }}
          >
            <Text className='preview-switch__text'>3D</Text>
          </View>
        </View>
      ) : (
        <Text className='preview-unsupported'>{XR_FRAME_UNSUPPORTED_TEXT}</Text>
      )}
      <Text className='preview-mode'>当前：{mode === '3d' && canUse3d ? '3D' : '2D'}</Text>
      {mode === '3d' && canUse3d
        ? createElement('xr-furniture', {
            className: 'preview-xr',
            floorScale,
            cubesJson,
            onReady: () => {
              readyRef.current = true
              clearTimeout(timeoutRef.current)
            },
            onError: fallback,
          })
        : <PreviewFloor2d room={room} products={planProducts} />}
    </View>
  )
}

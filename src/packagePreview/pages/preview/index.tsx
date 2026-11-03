import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { PreviewFloor2d } from '../../components/preview-2d'
import { useCatalogStore } from '../../../stores/catalogStore'
import { selectPlanById, usePlanStore } from '../../../stores/planStore'
import { selectScanByPlanId, useScanStore } from '../../../stores/scanStore'
import type { Product } from '../../../types/domain'
import { resolvePreviewRoom } from '../../../utils/previewLayout'
import './index.scss'

export default function PreviewPage() {
  const router = useRouter()
  const planId = router.params.planId ?? ''
  const plan = usePlanStore((state) => selectPlanById(state, planId))
  const scan = useScanStore((state) => selectScanByPlanId(state, planId))
  const products = useCatalogStore((state) => state.products)

  if (!plan) {
    return (
      <View className='page'>
        <Text className='preview-missing'>方案不存在</Text>
      </View>
    )
  }

  const room = resolvePreviewRoom(scan)
  const planProducts: Product[] = plan.productIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item): item is Product => item != null)

  return (
    <View className='page'>
      <Text className='preview-title'>预览</Text>
      <Text className='preview-mode'>当前：2D</Text>
      <PreviewFloor2d room={room} products={planProducts} />
    </View>
  )
}

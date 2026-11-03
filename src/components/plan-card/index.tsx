import { Image, Text, View } from '@tarojs/components'
import { ROOM_LABELS, STAGE_LABELS } from '../../constants/labels'
import type { Plan } from '../../types/domain'
import { formatPlanArea } from '../../utils/plans'
import './index.scss'

export type PlanCardProps = {
  plan: Plan
  isCurrent: boolean
  coverUrl?: string
  onOpen: (planId: string) => void
  onSetCurrent: (planId: string) => void
}

export function PlanCard({ plan, isCurrent, coverUrl, onOpen, onSetCurrent }: PlanCardProps) {
  return (
    <View className='plan-card'>
      <View className='plan-card__body' onClick={() => onOpen(plan.id)}>
        {coverUrl ? (
          <Image className='plan-card__cover' src={coverUrl} mode='aspectFill' />
        ) : (
          <View className='plan-card__cover plan-card__cover--empty' />
        )}
        <View className='plan-card__info'>
          <Text className='plan-card__title'>{plan.title}</Text>
          <Text className='plan-card__meta'>
            {ROOM_LABELS[plan.roomType]} · {formatPlanArea(plan.areaM2)} · {STAGE_LABELS[plan.stage]}
          </Text>
        </View>
      </View>
      {isCurrent ? (
        <View className='plan-card__badge'>
          <Text className='plan-card__badge-text'>当前</Text>
        </View>
      ) : (
        <View className='plan-card__action' onClick={() => onSetCurrent(plan.id)}>
          <Text className='plan-card__action-text'>设为当前</Text>
        </View>
      )}
    </View>
  )
}

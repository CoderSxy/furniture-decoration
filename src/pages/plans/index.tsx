// src/pages/plans/index.tsx
import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { PlanCard } from '../../components/plan-card'
import { ROOM_CREATE_OPTIONS, ROOM_LABELS } from '../../constants/labels'
import { useBudgetStore } from '../../stores/budgetStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { usePlanStore } from '../../stores/planStore'
import type { RoomType } from '../../types/domain'
import { planDetailUrl } from '../../utils/navigation'
import { resolveCoverProductId } from '../../utils/plans'
import './index.scss'

const CREATE_ERRORS: Record<'invalid-title' | 'invalid-room' | 'invalid-area', string> = {
  'invalid-title': '请填写标题',
  'invalid-room': '请选择房间',
  'invalid-area': '面积须大于 0 且不超过 10000㎡',
}

export default function PlansPage() {
  const plans = usePlanStore((state) => state.plans)
  const activePlanId = usePlanStore((state) => state.activePlanId)
  const createPlan = usePlanStore((state) => state.createPlan)
  const setActivePlanId = usePlanStore((state) => state.setActivePlanId)
  const products = useCatalogStore((state) => state.products)
  const ensureForPlan = useBudgetStore((state) => state.ensureForPlan)

  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [areaText, setAreaText] = useState('')

  const resetForm = () => {
    setTitle('')
    setRoomType('living')
    setAreaText('')
    setFormOpen(false)
  }

  const submit = () => {
    const result = createPlan({
      title,
      roomType,
      areaM2: Number(areaText),
    })
    if (!result.ok) {
      Taro.showToast({ title: CREATE_ERRORS[result.reason], icon: 'none' })
      return
    }
    ensureForPlan(result.plan, products)
    resetForm()
  }

  return (
    <View className='page'>
      <View className='plans-toolbar' onClick={() => setFormOpen(true)}>
        <Text className='plans-toolbar__text'>新建方案</Text>
      </View>
      {formOpen ? (
        <View className='plans-form'>
          <Input
            className='plans-form__input'
            value={title}
            placeholder='方案标题'
            maxlength={30}
            onInput={(event) => setTitle(event.detail.value)}
          />
          <Text className='plans-form__legend'>房间</Text>
          <View className='plans-form__rooms'>
            {ROOM_CREATE_OPTIONS.map((option) => {
              const active = option === roomType
              return (
                <View
                  key={option}
                  className={active ? 'plans-form__chip plans-form__chip--active' : 'plans-form__chip'}
                  onClick={() => setRoomType(option)}
                >
                  <Text
                    className={
                      active ? 'plans-form__chip-text plans-form__chip-text--active' : 'plans-form__chip-text'
                    }
                  >
                    {ROOM_LABELS[option]}
                  </Text>
                </View>
              )
            })}
          </View>
          <Input
            className='plans-form__input'
            value={areaText}
            placeholder='面积（平方米）'
            onInput={(event) => setAreaText(event.detail.value)}
          />
          <View className='plans-form__submit' onClick={submit}>
            <Text className='plans-form__submit-text'>创建</Text>
          </View>
          <View className='plans-form__cancel' onClick={resetForm}>
            <Text className='plans-form__cancel-text'>取消</Text>
          </View>
        </View>
      ) : null}
      {plans.length === 0 ? (
        <View className='plans-empty'>
          <Text className='plans-empty__text'>还没有方案</Text>
          <Text className='plans-empty__action' onClick={() => setFormOpen(true)}>
            新建方案
          </Text>
        </View>
      ) : (
        plans.map((plan) => {
          const coverId = resolveCoverProductId(plan)
          const coverUrl = products.find((item) => item.id === coverId)?.coverUrl
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === activePlanId}
              coverUrl={coverUrl}
              onOpen={(planId) => {
                Taro.navigateTo({ url: planDetailUrl(planId) })
              }}
              onSetCurrent={setActivePlanId}
            />
          )
        })
      )}
    </View>
  )
}

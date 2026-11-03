import { useAiPreviewStore } from '../stores/aiPreviewStore'
import { useBudgetStore } from '../stores/budgetStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'
import { schedulePush } from './syncNotify'
import { recordTombstone } from './tombstones'

export function deletePlanAndRelated(planId: string): void {
  const now = new Date().toISOString()
  usePlanStore.getState().deletePlan(planId)
  useBudgetStore.getState().removePlan(planId)
  useScanStore.getState().removePlan(planId)
  useAiPreviewStore.getState().removePlan(planId)
  recordTombstone('plan', planId, now)
  recordTombstone('budget', planId, now)
  recordTombstone('scan', planId, now)
  recordTombstone('aiPreview', planId, now)
  schedulePush()
}

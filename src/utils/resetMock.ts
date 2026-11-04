// src/utils/resetMock.ts
import Taro from '@tarojs/taro'
import { LOGIN_REQUIRED_TEXT, SYNC_FAILED_TEXT } from '../constants/labels'
import { useAiPreviewStore } from '../stores/aiPreviewStore'
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'
import { apiRequest } from './apiClient'
import { isLoggedIn } from './authGate'

import { useSyncStore } from '../stores/syncStore'
import { getFailedStorageWrites } from './storage'
import { pauseSyncForClear } from './syncEngine'
import { clearTombstones } from './tombstones'

export function clearMyDataLocal(): { ok: boolean; failedKeys: string[] } {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
  useAiPreviewStore.getState().reset()
  clearTombstones()
  const failedKeys = getFailedStorageWrites()
  return { ok: failedKeys.length === 0, failedKeys }
}

export function resetMockData(): { ok: boolean; failedKeys: string[] } {
  return clearMyDataLocal()
}

export async function clearMyDataCloud(): Promise<void> {
  if (!isLoggedIn()) {
    Taro.showToast({ title: LOGIN_REQUIRED_TEXT, icon: 'none' })
    return
  }
  const { token, userId, generation: initialGeneration } = useSyncStore.getState()
  let resume: (() => void) | undefined
  try {
    resume = await pauseSyncForClear()
    const generation = useSyncStore.getState().generation
    if (generation !== initialGeneration + 1 || useSyncStore.getState().token !== token || useSyncStore.getState().userId !== userId) return
    const confirmed = await apiRequest<{ cleared: boolean; items: unknown[] }>('/api/sync', { method: 'DELETE' })
    if (useSyncStore.getState().generation !== generation) return
    if (confirmed.cleared !== true || !Array.isArray(confirmed.items) || confirmed.items.length !== 0) throw new Error('未确认清除')
    if (!clearMyDataLocal().ok) throw new Error('本机保存失败，请重试')
    Taro.showToast({ title: '已清除', icon: 'none' })
  } catch {
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
  } finally {
    resume?.()
  }
}

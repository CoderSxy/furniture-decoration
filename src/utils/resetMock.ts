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

import { getFailedStorageWrites } from './storage'
import { collectSyncItems } from './syncEngine'
import { clearTombstones, recordTombstone } from './tombstones'

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
  const now = new Date().toISOString()
  for (const item of collectSyncItems()) {
    if (item.deleted) continue
    recordTombstone(item.kind, item.itemId, now)
  }
  try {
    await apiRequest('/api/sync', {
      method: 'PUT',
      data: {
        clientTime: now,
        items: collectSyncItems(),
      },
    })
    clearMyDataLocal()
    Taro.showToast({ title: '已清除', icon: 'none' })
  } catch {
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
  }
}

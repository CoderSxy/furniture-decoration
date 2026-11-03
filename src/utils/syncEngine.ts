import Taro from '@tarojs/taro'
import { SYNC_FAILED_TEXT } from '../constants/labels'
import { useAiPreviewStore, type AiPreviewRecord } from '../stores/aiPreviewStore'
import { useBudgetStore } from '../stores/budgetStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePlanStore } from '../stores/planStore'
import { useScanStore } from '../stores/scanStore'
import { useSyncStore } from '../stores/syncStore'
import type { Budget, FavoriteRecord, Plan, RoomScan } from '../types/domain'
import type { SyncItem } from '../types/sync'
import { apiRequest, getApiBaseUrl } from './apiClient'
import { isLoggedIn } from './authGate'
import { mergeByUpdatedAt } from './syncMerge'
import { registerSchedulePush } from './syncNotify'
import { clearTombstones, dropAckedTombstones, listTombstones } from './tombstones'

const EPOCH = '1970-01-01T00:00:00.000Z'
const DEBOUNCE_MS = 800
const PULL_GAP_MS = 5000
const LOGIN_SYNC_TIMEOUT_MS = 8000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlight = false
let queued = false
let lastPullAt = 0

function itemKey(kind: string, itemId: string): string {
  return `${kind}:${itemId}`
}

export function collectSyncItems(): SyncItem[] {
  const map = new Map<string, SyncItem>()
  for (const fav of useFavoriteStore.getState().items) {
    map.set(itemKey('favorite', fav.productId), {
      kind: 'favorite',
      itemId: fav.productId,
      updatedAt: fav.updatedAt,
      deleted: false,
      payload: fav,
    })
  }
  for (const plan of usePlanStore.getState().plans) {
    map.set(itemKey('plan', plan.id), {
      kind: 'plan',
      itemId: plan.id,
      updatedAt: plan.updatedAt,
      deleted: false,
      payload: plan,
    })
  }
  const { activePlanId, activePlanUpdatedAt } = usePlanStore.getState()
  map.set(itemKey('preference', 'activePlanId'), {
    kind: 'preference',
    itemId: 'activePlanId',
    updatedAt: activePlanUpdatedAt ?? EPOCH,
    deleted: false,
    payload: { activePlanId },
  })
  for (const budget of Object.values(useBudgetStore.getState().budgets)) {
    map.set(itemKey('budget', budget.planId), {
      kind: 'budget',
      itemId: budget.planId,
      updatedAt: budget.updatedAt,
      deleted: false,
      payload: budget,
    })
  }
  for (const scan of Object.values(useScanStore.getState().scans)) {
    map.set(itemKey('scan', scan.planId), {
      kind: 'scan',
      itemId: scan.planId,
      updatedAt: scan.updatedAt,
      deleted: false,
      payload: { ...scan, photoPaths: [] },
    })
  }
  for (const preview of Object.values(useAiPreviewStore.getState().previews)) {
    map.set(itemKey('aiPreview', preview.planId), {
      kind: 'aiPreview',
      itemId: preview.planId,
      updatedAt: preview.updatedAt,
      deleted: false,
      payload: preview,
    })
  }
  for (const tomb of listTombstones()) {
    const key = itemKey(tomb.kind, tomb.itemId)
    const existing = map.get(key)
    if (existing == null || new Date(tomb.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      map.set(key, {
        kind: tomb.kind,
        itemId: tomb.itemId,
        updatedAt: tomb.updatedAt,
        deleted: true,
        payload: null,
      })
    }
  }
  return [...map.values()]
}

function reconcilePreference(): void {
  const { plans, activePlanId } = usePlanStore.getState()
  if (activePlanId != null && plans.some((plan) => plan.id === activePlanId)) return
  const newest = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  usePlanStore.getState().replaceAll({
    plans,
    activePlanId: newest?.id ?? null,
    activePlanUpdatedAt: new Date().toISOString(),
  })
}

export function applySyncItems(items: SyncItem[]): void {
  const favorites: FavoriteRecord[] = []
  const plans: Plan[] = []
  const budgets: Record<string, Budget> = {}
  const scans: Record<string, RoomScan> = {}
  const previews: Record<string, AiPreviewRecord> = {}
  let activePlanId: string | null = usePlanStore.getState().activePlanId
  let activePlanUpdatedAt = usePlanStore.getState().activePlanUpdatedAt

  for (const item of items) {
    if (item.deleted) continue
    if (item.kind === 'favorite' && item.payload != null && typeof item.payload === 'object') {
      favorites.push(item.payload as FavoriteRecord)
    } else if (item.kind === 'plan' && item.payload != null && typeof item.payload === 'object') {
      plans.push(item.payload as Plan)
    } else if (item.kind === 'preference' && item.payload != null && typeof item.payload === 'object') {
      const pref = item.payload as { activePlanId?: string | null }
      activePlanId = pref.activePlanId ?? null
      activePlanUpdatedAt = item.updatedAt
    } else if (item.kind === 'budget' && item.payload != null && typeof item.payload === 'object') {
      const budget = item.payload as Budget
      budgets[budget.planId] = budget
    } else if (item.kind === 'scan' && item.payload != null && typeof item.payload === 'object') {
      const scan = item.payload as RoomScan
      scans[scan.planId] = { ...scan, photoPaths: [] }
    } else if (item.kind === 'aiPreview' && item.payload != null && typeof item.payload === 'object') {
      const preview = item.payload as AiPreviewRecord
      previews[preview.planId] = preview
    }
  }

  useFavoriteStore.getState().replaceAll(favorites)
  usePlanStore.getState().replaceAll({ plans, activePlanId, activePlanUpdatedAt })
  useBudgetStore.getState().replaceAll(budgets)
  useScanStore.getState().replaceAll(scans)
  useAiPreviewStore.getState().replaceAll(previews)
  dropAckedTombstones(items)
  reconcilePreference()
}

function resetBusinessData(): void {
  useFavoriteStore.getState().reset()
  usePlanStore.getState().reset()
  useBudgetStore.getState().reset()
  useScanStore.getState().reset()
  useAiPreviewStore.getState().reset()
  clearTombstones()
}

async function pushNow(): Promise<void> {
  if (!isLoggedIn() || !getApiBaseUrl()) return
  const snapshot = await apiRequest<{ serverTime: string; items: SyncItem[] }>('/api/sync', {
    method: 'PUT',
    data: {
      clientTime: new Date().toISOString(),
      items: collectSyncItems(),
    },
  })
  applySyncItems(snapshot.items)
}

export function schedulePush(): void {
  if (!isLoggedIn() || !getApiBaseUrl()) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void (async () => {
      if (inFlight) {
        queued = true
        return
      }
      inFlight = true
      try {
        await pushNow()
      } catch {
        useSyncStore.getState().setPendingRetry(true)
      } finally {
        inFlight = false
        if (queued) {
          queued = false
          schedulePush()
        }
      }
    })()
  }, DEBOUNCE_MS)
}

registerSchedulePush(schedulePush)

export async function pullIfDue(now = Date.now()): Promise<void> {
  if (!isLoggedIn() || !getApiBaseUrl()) return
  if (now - lastPullAt < PULL_GAP_MS) return
  lastPullAt = now
  try {
    const remote = await apiRequest<{ serverTime: string; items: SyncItem[] }>('/api/sync', {
      method: 'GET',
    })
    const merged = mergeByUpdatedAt(collectSyncItems(), remote.items)
    applySyncItems(merged)
    const local = collectSyncItems()
    const needsPut = local.some((item) => {
      const remoteItem = remote.items.find((row) => row.kind === item.kind && row.itemId === item.itemId)
      if (remoteItem == null) return true
      return new Date(item.updatedAt).getTime() > new Date(remoteItem.updatedAt).getTime()
    }) || listTombstones().length > 0
    if (needsPut) await pushNow()
    useSyncStore.getState().setPendingRetry(false)
  } catch {
    useSyncStore.getState().setPendingRetry(true)
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
  }
}

async function loginSyncWork(): Promise<void> {
  const remote = await apiRequest<{ serverTime: string; items: SyncItem[] }>('/api/sync', {
    method: 'GET',
  })
  const merged = mergeByUpdatedAt(collectSyncItems(), remote.items)
  applySyncItems(merged)
  await pushNow()
}

export async function runLoginSync(previousUserId?: string | null): Promise<void> {
  const userId = useSyncStore.getState().userId
  if (previousUserId != null && previousUserId !== userId) {
    resetBusinessData()
  }
  try {
    await Promise.race([
      loginSyncWork(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), LOGIN_SYNC_TIMEOUT_MS)
      }),
    ])
    useSyncStore.getState().setPendingRetry(false)
  } catch {
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
    useSyncStore.getState().setPendingRetry(true)
  }
}

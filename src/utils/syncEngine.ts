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
import { resetBusinessData } from './businessData'
import { mergeByUpdatedAt } from './syncMerge'
import { registerSchedulePush } from './syncNotify'
import { dropAckedTombstones, listTombstones } from './tombstones'

const EPOCH = '1970-01-01T00:00:00.000Z'
const DEBOUNCE_MS = 800
const PULL_GAP_MS = 5000
const LOGIN_SYNC_TIMEOUT_MS = 8000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlight = false
let queued = false
let lastPullAt = 0
let clearing = false
const pendingPuts = new Set<Promise<unknown>>()

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
  if (activePlanId == null && plans.length === 0) return
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

  for (let item of items) {
    if (item.deleted) continue
    if (item.payload != null && typeof item.payload === 'object') {
      item = { ...item, payload: { ...item.payload, updatedAt: item.updatedAt } }
    }
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
  reconcilePreference()
}

type SyncContext = { generation: number; cancelled: boolean }
const context = (): SyncContext => ({ generation: useSyncStore.getState().generation, cancelled: false })
const current = (ctx: SyncContext): boolean => !clearing && !ctx.cancelled && ctx.generation === useSyncStore.getState().generation && !!useSyncStore.getState().token
const canSync = (): boolean => !clearing && useSyncStore.getState().verified && !!useSyncStore.getState().token && !!getApiBaseUrl()

// JSON copy is necessary: stores may replace records while the request is pending.
const snapshot = (): SyncItem[] => JSON.parse(JSON.stringify(collectSyncItems()))
const keyOf = (item: SyncItem): string => itemKey(item.kind, item.itemId)

function applyResponse(remote: SyncItem[], sent: SyncItem[]): boolean {
  const before = new Map(sent.map(item => [keyOf(item), JSON.stringify(item)]))
  const changes = snapshot().filter(item => before.get(keyOf(item)) !== JSON.stringify(item))
  // Only actual server responses acknowledge deletes. A changed local delete survives.
  dropAckedTombstones(remote.filter(item => !changes.some(change => keyOf(change) === keyOf(item))), sent)
  const result = new Map(remote.map(item => [keyOf(item), item]))
  for (const item of changes) result.set(keyOf(item), item)
  applySyncItems([...result.values()])
  return changes.length > 0
}

async function pushNow(ctx: SyncContext): Promise<void> {
  if (!current(ctx) || !canSync()) return
  const sent = snapshot()
  const request = apiRequest<{ serverTime: string; items: SyncItem[] }>('/api/sync', {
    isActive: () => current(ctx), method: 'PUT', data: { clientTime: new Date().toISOString(), items: sent },
  })
  pendingPuts.add(request)
  let result: { serverTime: string; items: SyncItem[] }
  try { result = await request } finally { pendingPuts.delete(request) }
  if (!current(ctx)) return
  if (applyResponse(result.items, sent)) schedulePush()
}

// Session changes invalidate both timers and responses, including old 401s.
useSyncStore.subscribe((state, previous) => {
  if (state.generation === previous.generation) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  queued = false
  inFlight = false
  lastPullAt = 0
})

export function schedulePush(): void {
  if (!canSync()) return
  const ctx = context()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (!current(ctx)) return
    if (inFlight) { queued = true; return }
    inFlight = true
    void pushNow(ctx).catch(() => {
      if (current(ctx)) useSyncStore.getState().setPendingRetry(true)
    }).finally(() => {
      if (!current(ctx)) return
      inFlight = false
      if (queued) { queued = false; schedulePush() }
    })
  }, DEBOUNCE_MS)
}

registerSchedulePush(schedulePush)

async function pullAndPush(ctx: SyncContext, alwaysPush: boolean): Promise<void> {
  const remote = await apiRequest<{ serverTime: string; items: SyncItem[] }>('/api/sync', { method: 'GET', isActive: () => current(ctx) })
  if (!current(ctx)) return
  const merged = mergeByUpdatedAt(collectSyncItems(), remote.items)
  dropAckedTombstones(remote.items)
  applySyncItems(merged)
  if (alwaysPush || JSON.stringify(collectSyncItems()) !== JSON.stringify(remote.items)) await pushNow(ctx)
}

export async function pullIfDue(now = Date.now()): Promise<void> {
  if (!canSync() || now - lastPullAt < PULL_GAP_MS) return
  lastPullAt = now
  const ctx = context()
  try {
    await pullAndPush(ctx, false)
    if (current(ctx)) useSyncStore.getState().setPendingRetry(false)
  } catch {
    if (!current(ctx)) return
    useSyncStore.getState().setPendingRetry(true)
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
  }
}

export async function runLoginSync(previousUserId?: string | null): Promise<void> {
  if (previousUserId != null && previousUserId !== useSyncStore.getState().userId) resetBusinessData()
  const ctx = context()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      pullAndPush(ctx, true),
      new Promise<void>((_, reject) => {
        timeout = setTimeout(() => { ctx.cancelled = true; reject(new Error('timeout')) }, LOGIN_SYNC_TIMEOUT_MS)
      }),
    ])
    if (current(ctx)) useSyncStore.getState().setPendingRetry(false)
  } catch {
    if (ctx.generation !== useSyncStore.getState().generation) return
    Taro.showToast({ title: SYNC_FAILED_TEXT, icon: 'none' })
    useSyncStore.getState().setPendingRetry(true)
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function pauseSyncForClear(): Promise<() => void> {
  if (clearing) throw new Error('正在清除')
  clearing = true
  useSyncStore.setState(state => ({ generation: state.generation + 1 }))
  await Promise.allSettled([...pendingPuts])
  return () => { clearing = false }
}

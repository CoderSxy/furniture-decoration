import Router from '@koa/router'
import type { AppDeps, SyncItemRow } from '../db/ports.ts'
import { ApiError } from '../errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { hitRateLimit, syncRateKey } from '../services/rateLimit.ts'
import { clampUpdatedAt, parseIso, shouldTakeIncoming, toIso } from '../services/merge.ts'
import { validateSyncPut } from '../services/validateSync.ts'
import type { SyncItem } from '../types/sync.ts'

function rowToItem(row: SyncItemRow): SyncItem {
  return {
    kind: row.kind,
    itemId: row.item_id,
    updatedAt: toIso(row.updated_at),
    deleted: row.deleted === 1,
    payload: row.payload,
  }
}

export function registerSync(router: Router): void {
  router.get('/api/sync', requireAuth, async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    await hitRateLimit(deps.redis, syncRateKey(ctx.state.userId), 60, 60)
    const rows = await deps.mysql.listSyncItems(ctx.state.userId)
    ctx.body = { serverTime: toIso(deps.clock()), items: rows.map(rowToItem) }
  })

  router.put('/api/sync', requireAuth, async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    await hitRateLimit(deps.redis, syncRateKey(ctx.state.userId), 60, 60)
    const body = ctx.request.body as { clientTime?: unknown; items?: unknown }
    if (!Array.isArray(body.items)) throw new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')
    validateSyncPut(body.items)
    const userId = ctx.state.userId as string
    const now = deps.clock()
    await deps.mysql.withTransaction(async (tx) => {
      for (const raw of body.items as SyncItem[]) {
        let incomingAt = parseIso(raw.updatedAt)
        if (incomingAt == null) throw new ApiError(400, 'VALIDATION_ERROR', '同步数据不合法')
        incomingAt = clampUpdatedAt(incomingAt, now)
        let payload = raw.deleted ? null : raw.payload
        if (raw.kind === 'scan' && payload != null && typeof payload === 'object') {
          payload = { ...(payload as object), photoPaths: [] }
        }
        const existing = await tx.getSyncItem(userId, raw.kind, raw.itemId)
        if (!shouldTakeIncoming(incomingAt, existing?.updated_at ?? null)) continue
        await tx.upsertSyncItem({
          user_id: userId,
          kind: raw.kind,
          item_id: raw.itemId,
          payload,
          updated_at: incomingAt,
          deleted: raw.deleted ? 1 : 0,
          created_at: existing?.created_at ?? now,
        })
      }
    })
    const rows = await deps.mysql.listSyncItems(userId)
    ctx.body = { serverTime: toIso(now), items: rows.map(rowToItem) }
  })
}

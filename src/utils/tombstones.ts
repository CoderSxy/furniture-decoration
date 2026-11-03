import { TOMBSTONES_STORAGE_KEY } from '../constants/storageKeys'
import type { SyncItem, SyncKind } from '../types/sync'
import { readJSON, writeJSON } from './storage'

export type Tombstone = {
  kind: SyncKind
  itemId: string
  updatedAt: string
}

function parseTombstones(input: unknown): Tombstone[] {
  if (!Array.isArray(input)) return []
  const rows: Tombstone[] = []
  for (const row of input) {
    if (row == null || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    if (typeof item.kind !== 'string' || typeof item.itemId !== 'string' || typeof item.updatedAt !== 'string') {
      continue
    }
    rows.push({ kind: item.kind as SyncKind, itemId: item.itemId, updatedAt: item.updatedAt })
  }
  return rows
}

function persist(rows: Tombstone[]): void {
  writeJSON(TOMBSTONES_STORAGE_KEY, rows)
}

export function listTombstones(): Tombstone[] {
  return parseTombstones(readJSON<unknown>(TOMBSTONES_STORAGE_KEY, []))
}

export function recordTombstone(kind: SyncKind, itemId: string, updatedAt: string): void {
  const next = listTombstones().filter((row) => !(row.kind === kind && row.itemId === itemId))
  next.push({ kind, itemId, updatedAt })
  persist(next)
}

export function dropAckedTombstones(serverItems: SyncItem[]): void {
  const remaining = listTombstones().filter((row) => {
    const ack = serverItems.find(
      (item) => item.kind === row.kind && item.itemId === row.itemId && item.deleted,
    )
    if (ack == null) return true
    return new Date(ack.updatedAt).getTime() < new Date(row.updatedAt).getTime()
  })
  persist(remaining)
}

export function clearTombstones(): void {
  persist([])
}

import type { SyncItemRow } from './ports.ts'

type Execute = (sql: string, values: unknown[]) => Promise<unknown>

export async function writeSyncItem(execute: Execute, row: SyncItemRow): Promise<void> {
  // MySQL evaluates assignments in order: advance updated_at last so both fields
  // compare against the stored version. Strict > preserves existing rows on ties.
  await execute(
    `INSERT INTO sync_items (user_id, kind, item_id, payload, updated_at, deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payload = IF(VALUES(updated_at) > updated_at, VALUES(payload), payload),
       deleted = IF(VALUES(updated_at) > updated_at, VALUES(deleted), deleted),
       updated_at = IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)`,
    [row.user_id, row.kind, row.item_id, row.payload == null ? null : JSON.stringify(row.payload), row.updated_at, row.deleted, row.created_at],
  )
}

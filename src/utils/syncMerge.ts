import type { SyncItem } from '../types/sync'

function keyOf(item: SyncItem): string {
  return `${item.kind}:${item.itemId}`
}

export function mergeByUpdatedAt(local: SyncItem[], remote: SyncItem[]): SyncItem[] {
  const map = new Map<string, SyncItem>()
  for (const item of local) {
    map.set(keyOf(item), item)
  }
  for (const item of remote) {
    const current = map.get(keyOf(item))
    if (current == null) {
      map.set(keyOf(item), item)
      continue
    }
    const localMs = new Date(current.updatedAt).getTime()
    const remoteMs = new Date(item.updatedAt).getTime()
    if (remoteMs >= localMs) map.set(keyOf(item), item)
  }
  return [...map.values()]
}

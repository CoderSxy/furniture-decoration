export type KeyValueStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

let storage: KeyValueStorage = {
  getItem: () => null,
  setItem: () => undefined,
}

export function configureStorage(next: KeyValueStorage): void {
  storage = next
}

export function createMemoryStorage(
  initial: Record<string, string> = {},
): KeyValueStorage {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    if (raw == null || raw === '') return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export type StorageWriteResult = { ok: true } | { ok: false; key: string; error: unknown }

const failedWrites = new Map<string, { value: unknown; error: unknown }>()
let onWriteFailure: (key: string) => void = () => undefined

export function configureStorageFailureHandler(handler: (key: string) => void): void {
  onWriteFailure = handler
}

export function getFailedStorageWrites(): string[] {
  return [...failedWrites.keys()]
}

export function retryFailedStorageWrites(): StorageWriteResult[] {
  return [...failedWrites].map(([key, entry]) => writeJSON(key, entry.value))
}

export function writeJSON(key: string, value: unknown): StorageWriteResult {
  try {
    storage.setItem(key, JSON.stringify(value))
    failedWrites.delete(key)
    return { ok: true }
  } catch (error) {
    failedWrites.set(key, { value, error })
    try { onWriteFailure(key) } catch { /* Notification must not interrupt startup. */ }
    return { ok: false, key, error }
  }
}

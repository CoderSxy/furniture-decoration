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
  const raw = storage.getItem(key)
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value))
}

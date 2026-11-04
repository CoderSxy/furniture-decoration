import { claimBusinessData, migrateBusinessOwner } from '../utils/businessData'
import { create } from 'zustand'
import { AUTH_STORAGE_KEY } from '../constants/storageKeys'
import type { AuthRecord } from '../types/sync'
import { readJSON, writeJSON } from '../utils/storage'

function parseAuth(input: unknown): AuthRecord {
  if (input == null || typeof input !== 'object') {
    return { token: null, userId: null, loggedInAt: null }
  }
  const row = input as Record<string, unknown>
  const token = typeof row.token === 'string' && row.token.length > 0 ? row.token : null
  const userId = typeof row.userId === 'string' && row.userId.length > 0 ? row.userId : null
  const loggedInAt = typeof row.loggedInAt === 'string' && row.loggedInAt.length > 0 ? row.loggedInAt : null
  if (token == null || userId == null) {
    return { token: null, userId: null, loggedInAt: null }
  }
  return { token, userId, loggedInAt }
}

export type SyncState = {
  token: string | null
  userId: string | null
  loggedInAt: string | null
  generation: number
  verified: boolean
  pendingRetry: boolean
  hydrate: () => void
  setSession: (input: { token: string; userId: string }) => void
  clearSession: () => void
  setPendingRetry: (flag: boolean) => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  token: null,
  userId: null,
  loggedInAt: null,
  generation: 0,
  verified: false,
  pendingRetry: false,
  hydrate: () => {
    const parsed = parseAuth(readJSON<unknown>(AUTH_STORAGE_KEY, null))
    migrateBusinessOwner(parsed.userId)
    set({ ...parsed, verified: false, generation: get().generation + 1 })
  },
  setSession: ({ token, userId }) => {
    claimBusinessData(userId)
    const loggedInAt = new Date().toISOString()
    const record: AuthRecord = { token, userId, loggedInAt }
    writeJSON(AUTH_STORAGE_KEY, record)
    set({ ...record, verified: true, generation: get().generation + 1 })
  },
  clearSession: () => {
    const record: AuthRecord = { token: null, userId: null, loggedInAt: null }
    writeJSON(AUTH_STORAGE_KEY, record)
    set({ ...record, verified: false, generation: get().generation + 1 })
  },
  setPendingRetry: (flag) => {
    set({ pendingRetry: flag })
  },
}))

import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { AUTH_STORAGE_KEY } from '../src/constants/storageKeys.ts'
import { useSyncStore } from '../src/stores/syncStore.ts'
import { configureStorage, createMemoryStorage, readJSON } from '../src/utils/storage.ts'

describe('syncStore auth persistence', { concurrency: false }, () => {
  beforeEach(() => {
    configureStorage(createMemoryStorage())
    useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
  })

  it('setSession writes fd:auth and hydrate restores it', () => {
    useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
    const stored = readJSON(AUTH_STORAGE_KEY, null) as { token: string; userId: string; loggedInAt: string }
    assert.equal(stored.token, 'sid.sig')
    assert.equal(stored.userId, 'user-1')
    assert.match(stored.loggedInAt, /^\d{4}-\d{2}-\d{2}T/)
    useSyncStore.setState({ token: null, userId: null, loggedInAt: null, pendingRetry: false })
    useSyncStore.getState().hydrate()
    assert.equal(useSyncStore.getState().token, 'sid.sig')
    assert.equal(useSyncStore.getState().userId, 'user-1')
  })

  it('clearSession drops token but does not touch other keys', () => {
    useSyncStore.getState().setSession({ token: 'sid.sig', userId: 'user-1' })
    useSyncStore.getState().clearSession()
    assert.equal(useSyncStore.getState().token, null)
    assert.deepEqual(readJSON(AUTH_STORAGE_KEY, { keep: true }), {
      token: null,
      userId: null,
      loggedInAt: null,
    })
  })
})

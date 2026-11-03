import assert from 'node:assert/strict'
import test from 'node:test'
import { createScanCancellation, probeScanCapability, releaseScanSession, prepareScanSession } from '../src/utils/scanCapability.ts'

test('permissions finish before creating or starting session; denial never creates', async () => {
  const events: string[] = []
  const deps = {
    getSdkVersion: () => '3.0.0',
    createVKSession: () => {
      events.push('create')
      return { start: (cb: (status: unknown) => void) => { events.push('start'); cb(0) }, destroy() {}, hitTest: () => [] }
    },
    privacy: { requirePrivacyAuthorize: async () => { events.push('privacy') }, authorizeCamera: async () => { events.push('camera') } },
  }
  await prepareScanSession(deps)
  assert.deepEqual(events, ['privacy', 'camera', 'create', 'start'])
  events.length = 0
  await prepareScanSession({ ...deps, privacy: { ...deps.privacy, requirePrivacyAuthorize: async () => { throw Error('denied') } } })
  assert.deepEqual(events, [])
})

test('start timeout or cancellation releases once, including late callback', async () => {
  for (const cancel of [false, true]) {
    const controller = createScanCancellation()
    let destroyed = 0
    let callback: (status: unknown) => void = () => {}
    const session = { start: (cb: typeof callback) => { callback = cb }, destroy: () => { destroyed++ }, hitTest: () => [] }
    const pending = probeScanCapability({ getSdkVersion: () => '3.0.0', createVKSession: () => session, timeoutMs: 5, signal: controller.signal })
    if (cancel) controller.abort()
    assert.deepEqual(await pending, { capability: 'manual', session: null })
    callback(0)
    releaseScanSession(session)
    assert.equal(destroyed, 1)
  }
})

test('cancelling during privacy never asks for camera or creates a session', async () => {
  const controller = createScanCancellation()
  let finishPrivacy: () => void = () => {}
  let camera = 0
  let created = 0
  const pending = prepareScanSession({
    getSdkVersion: () => '3.0.0', signal: controller.signal,
    privacy: {
      requirePrivacyAuthorize: () => new Promise<void>((resolve) => { finishPrivacy = resolve }),
      authorizeCamera: async () => { camera++ },
    },
    createVKSession: () => { created++; throw Error('unexpected') },
  })
  controller.abort()
  finishPrivacy()
  assert.equal((await pending).capability, 'manual')
  assert.equal(camera, 0)
  assert.equal(created, 0)
})

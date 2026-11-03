import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isVisionKitV2SdkSupported,
  MIN_VISIONKIT_SDK_VERSION,
  probeScanCapability,
} from '../src/utils/scanCapability.ts'
import type { VkSessionHandle } from '../src/types/vk.ts'

describe('scanCapability', () => {
  it('rejects SDKVersion below 2.22.0', () => {
    assert.equal(MIN_VISIONKIT_SDK_VERSION, '2.22.0')
    assert.equal(isVisionKitV2SdkSupported('2.21.4'), false)
    assert.equal(isVisionKitV2SdkSupported('2.22.0'), true)
    assert.equal(isVisionKitV2SdkSupported('2.25.1'), true)
  })

  it('falls back when createVKSession is missing or start fails, and keeps the session on success', async () => {
    const low = await probeScanCapability({
      getSdkVersion: () => '2.20.0',
      createVKSession: () => {
        throw new Error('should not create')
      },
    })
    assert.deepEqual(low, { capability: 'manual', session: null })

    const missing = await probeScanCapability({ getSdkVersion: () => '2.22.0' })
    assert.deepEqual(missing, { capability: 'manual', session: null })

    let destroyed = 0
    const failing: VkSessionHandle = {
      start: (cb) => cb(2000002),
      destroy: () => {
        destroyed += 1
      },
      hitTest: () => [],
    }
    const failed = await probeScanCapability({
      getSdkVersion: () => '2.22.0',
      createVKSession: (opts) => {
        assert.deepEqual(opts, { version: 'v2', track: { plane: { mode: 1 } } })
        return failing
      },
    })
    assert.deepEqual(failed, { capability: 'manual', session: null })
    assert.equal(destroyed, 1)

    const okSession: VkSessionHandle = {
      start: (cb) => cb(0),
      destroy: () => {
        throw new Error('must not destroy success session')
      },
      hitTest: () => [],
    }
    const ok = await probeScanCapability({
      getSdkVersion: () => '3.6.5',
      createVKSession: () => okSession,
    })
    assert.equal(ok.capability, 'visionkit-v2')
    assert.equal(ok.session, okSession)
  })
})

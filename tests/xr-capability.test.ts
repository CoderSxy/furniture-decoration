import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isXrFrameSupported,
  MIN_XR_FRAME_SDK_VERSION,
  readXrFrameSupport,
} from '../src/utils/xrCapability.ts'

test('xr-frame requires WeChat SDK 2.32.0', () => {
  assert.equal(MIN_XR_FRAME_SDK_VERSION, '2.32.0')
  assert.equal(isXrFrameSupported('2.31.0'), false)
  assert.equal(isXrFrameSupported('2.32.0'), true)
  assert.equal(isXrFrameSupported('3.0.0'), true)
})

test('readXrFrameSupport treats missing system info as unsupported', () => {
  assert.equal(
    readXrFrameSupport({
      getSdkVersion: () => {
        throw new Error('no sys')
      },
    }),
    false,
  )
  assert.equal(readXrFrameSupport({ getSdkVersion: () => '2.32.0' }), true)
})

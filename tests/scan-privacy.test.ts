import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureCameraPrivacy } from '../src/utils/scanPrivacy.ts'

test('ensureCameraPrivacy requires both privacy and camera scope', async () => {
  assert.equal(
    await ensureCameraPrivacy({
      requirePrivacyAuthorize: async () => {
        throw new Error('denied')
      },
      authorizeCamera: async () => undefined,
    }),
    false,
  )
  assert.equal(
    await ensureCameraPrivacy({
      requirePrivacyAuthorize: async () => undefined,
      authorizeCamera: async () => {
        throw new Error('no-camera')
      },
    }),
    false,
  )
  assert.equal(
    await ensureCameraPrivacy({
      requirePrivacyAuthorize: async () => undefined,
      authorizeCamera: async () => undefined,
    }),
    true,
  )
})

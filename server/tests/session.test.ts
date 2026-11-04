import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionKey,
  signSid,
  verifySessionToken,
} from '../src/services/session.ts'
import { memoryRedis } from './fakes.ts'

const SECRET = 's'.repeat(32)
const OTHER = 't'.repeat(32)

test('token is sid.sig and HMAC must match SESSION_SECRET', () => {
  const sid = 'abcdefghijklmnopqrstuvwxyz012345'
  const token = createSessionToken(SECRET, sid)
  assert.equal(token, `${sid}.${signSid(SECRET, sid)}`)
  assert.equal(verifySessionToken(SECRET, token), sid)
  assert.equal(verifySessionToken(OTHER, token), null)
  assert.equal(verifySessionToken(SECRET, `${sid}.aaaa`), null)
  assert.equal(verifySessionToken(SECRET, 'noperiod'), null)
  assert.equal(sessionKey(sid), `sess:${sid}`)
  assert.equal(SESSION_TTL_SECONDS, 2592000)
})

test('redis session round-trip stores only userId JSON', async () => {
  const redis = memoryRedis()
  const sid = 'sid-1'
  await redis.set(sessionKey(sid), JSON.stringify({ userId: 'user-1' }), SESSION_TTL_SECONDS)
  assert.deepEqual(JSON.parse((await redis.get(sessionKey(sid)))!), { userId: 'user-1' })
  await redis.del(sessionKey(sid))
  assert.equal(await redis.get(sessionKey(sid)), null)
})

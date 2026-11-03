import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const TEXT = readFileSync('docs/weapp-publish-checklist.md', 'utf8')

test('publish checklist describes openid sync and still forbids phone number', () => {
  assert.match(TEXT, /openid/)
  assert.match(TEXT, /不收集手机号/)
  assert.match(TEXT, /request 合法域名/)
  assert.equal(TEXT.includes('不做登录'), false)
  assert.equal(TEXT.includes('默认不联网'), false)
  assert.match(TEXT, /扫描参考图|参考图.*不上云|照片.*不上云/)
})

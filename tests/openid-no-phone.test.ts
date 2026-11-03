import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('source has no phone-number login APIs and no skip-login backdoor', () => {
  const src = execSync('rg -n "getPhoneNumber|getUserProfile|open-type=.getPhoneNumber" src || true', {
    encoding: 'utf8',
  })
  assert.equal(src.trim(), '')
  const skip = execSync('rg -n "skipLogin|bypassAuth|debugLogin" src || true', { encoding: 'utf8' })
  assert.equal(skip.trim(), '')
  const rootPkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  for (const name of ['koa', 'mysql2', 'ioredis']) {
    assert.equal(rootPkg.dependencies?.[name], undefined)
    assert.equal(rootPkg.devDependencies?.[name], undefined)
  }
})

test('tracked files do not contain AppSecret or session secret assignments', () => {
  const hits = execSync(
    'rg -n "WECHAT_APPSECRET\\s*=\\s*[\'\\"][^\'\\"]+[\'\\"]|SESSION_SECRET\\s*=\\s*[\'\\"][^\'\\"]{8,}[\'\\"]" --glob "!docs/**" --glob "!server/tests/**" || true',
    { encoding: 'utf8' },
  )
  assert.equal(hits.trim(), '')
})

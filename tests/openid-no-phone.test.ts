import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function search(args: string[]): string {
  const result = spawnSync('rg', ['-n', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 })
  if (result.error) throw result.error
  assert.ok(result.status === 0 || result.status === 1, result.stderr)
  return result.stdout.trim()
}

test('source has no phone-number login APIs and no skip-login backdoor', () => {
  assert.equal(search(['getPhoneNumber|getUserProfile|open-type=.getPhoneNumber', 'src']), '')
  assert.equal(search(['skipLogin|bypassAuth|debugLogin', 'src']), '')
  const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'))
  for (const name of ['koa', 'mysql2', 'ioredis']) {
    assert.equal(rootPkg.dependencies?.[name], undefined)
    assert.equal(rootPkg.devDependencies?.[name], undefined)
  }
})

test('repository does not contain secret assignments', () => {
  assert.equal(search([
    String.raw`(?:WECHAT_APPSECRET|SESSION_SECRET|MYSQL_PASSWORD|REDIS_PASSWORD)\s*=\s*['"][^'"]+['"]`,
    '--glob', '!docs/**', '--glob', '!server/tests/**', '.',
  ]), '')
})

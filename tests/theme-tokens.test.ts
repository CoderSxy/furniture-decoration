import assert from 'node:assert/strict'
import test from 'node:test'
import { tokens } from '../src/theme/tokens.ts'

test('tokens expose furniture MVP color and space keys', () => {
  assert.equal(tokens.color.primary, '#C45C26')
  assert.equal(tokens.color.surface, '#F7F3EE')
  assert.equal(tokens.color.text, '#1F1B16')
  assert.equal(tokens.color.danger, '#C0392B')
  assert.equal(tokens.space.md, 16)
  assert.equal(tokens.radius.md, 12)
})

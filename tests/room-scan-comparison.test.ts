import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const COMPARISON = readFileSync(
  'docs/superpowers/specs/2026-11-03-room-scan-comparison.md',
  'utf8',
)

test('comparison covers every M4 candidate and the locked recommendation', () => {
  for (const needle of [
    'VisionKit',
    'xr-frame',
    'threejs-miniprogram',
    'DUSt3R',
    'MASt3R',
    'Depth Anything V2',
    'VGGT',
    'MapAnything',
    'Roomform',
    'COLMAP',
    'GLOMAP',
  ]) {
    assert.ok(COMPARISON.includes(needle), `missing candidate ${needle}`)
  }
  assert.ok(COMPARISON.includes('CC BY-NC'))
  assert.ok(COMPARISON.includes('不把重建模型') || COMPARISON.includes('重建模型打进'))
  assert.ok(COMPARISON.includes('主方案'))
  assert.ok(COMPARISON.includes('visionkit-v2'))
  assert.ok(COMPARISON.includes('manual'))
  assert.ok(COMPARISON.includes('访问你的摄像头'))
  assert.ok(COMPARISON.includes('2800'))
  assert.ok(COMPARISON.includes('缺真机'))
})

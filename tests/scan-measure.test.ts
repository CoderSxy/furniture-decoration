import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  appendPhotoPaths,
  applyHit,
  buildManualScan,
  buildVisionKitScan,
  canSaveMeasure,
  createMeasureState,
  DEFAULT_ROOM_HEIGHT_MM,
  distanceMmBetweenTransforms,
  MANUAL_SCAN_ERRORS,
  MAX_SCAN_PHOTOS,
  measureHint,
  metersToMm,
  validateManualScan,
} from '../src/utils/scanMeasure.ts'

function transformAt(x: number, y: number, z: number): number[] {
  const m = new Array(16).fill(0)
  m[0] = 1
  m[5] = 1
  m[10] = 1
  m[15] = 1
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}

describe('scanMeasure', () => {
  it('converts meters to mm and measures hitTest Euclidean distance', () => {
    assert.equal(DEFAULT_ROOM_HEIGHT_MM, 2800)
    assert.equal(MAX_SCAN_PHOTOS, 3)
    assert.equal(metersToMm(3.6), 3600)
    assert.equal(distanceMmBetweenTransforms(transformAt(0, 0, 0), transformAt(4, 0, 0)), 4000)
    assert.equal(distanceMmBetweenTransforms(transformAt(0, 0, 0), transformAt(0, 0, 0)), null)
    assert.equal(distanceMmBetweenTransforms([1, 2, 3], transformAt(1, 0, 0)), null)
  })

  it('validates manual draft and builds RoomScan without uploading photos', () => {
    assert.equal(
      validateManualScan({
        planId: '',
        widthText: '4000',
        depthText: '3000',
        heightText: '2800',
        photoPaths: [],
      }),
      'invalid-plan',
    )
    assert.equal(
      validateManualScan({
        planId: 'p1',
        widthText: '0',
        depthText: '3000',
        heightText: '2800',
        photoPaths: [],
      }),
      'invalid-width',
    )
    assert.equal(
      validateManualScan({
        planId: 'p1',
        widthText: '4000',
        depthText: '-1',
        heightText: '2800',
        photoPaths: [],
      }),
      'invalid-depth',
    )
    assert.equal(
      validateManualScan({
        planId: 'p1',
        widthText: '4000',
        depthText: '3000',
        heightText: '0',
        photoPaths: [],
      }),
      'invalid-height',
    )
    assert.equal(
      validateManualScan({
        planId: 'p1',
        widthText: '4000',
        depthText: '3000',
        heightText: '2800',
        photoPaths: ['a', 'b', 'c', 'd'],
      }),
      'invalid-photos',
    )
    assert.equal(MANUAL_SCAN_ERRORS['invalid-width'], '长度须大于 0 且不超过 100000 mm')
    assert.deepEqual(
      appendPhotoPaths(['a'], ['b', 'c', 'd', 'e']),
      ['a', 'b', 'c'],
    )
    const draft = {
      planId: 'p1',
      widthText: '4000',
      depthText: '3000',
      heightText: '2800',
      photoPaths: ['tmp://one.jpg'],
    }
    assert.equal(validateManualScan(draft), 'ok')
    assert.deepEqual(buildManualScan(draft, '2026-11-03T08:00:00.000Z'), {
      planId: 'p1',
      source: 'manual',
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2800,
      photoPaths: ['tmp://one.jpg'],
      capturedAt: '2026-11-03T08:00:00.000Z',
      updatedAt: '2026-11-03T08:00:00.000Z',
    })
    assert.deepEqual(
      buildVisionKitScan({
        planId: 'p1',
        widthMm: 4000,
        depthMm: 3000,
        heightMm: 2800,
        capturedAt: '2026-11-03T08:00:00.000Z',
      }),
      {
        planId: 'p1',
        source: 'visionkit-v2',
        widthMm: 4000,
        depthMm: 3000,
        heightMm: 2800,
        photoPaths: [],
        capturedAt: '2026-11-03T08:00:00.000Z',
        updatedAt: '2026-11-03T08:00:00.000Z',
      },
    )
  })

  it('advances two pairs of ground hits then waits for height', () => {
    let state = createMeasureState()
    assert.equal(state.heightMm, 2800)
    assert.equal(measureHint(state.phase), '点击地面第一点，测量长度')
    assert.equal(canSaveMeasure(state), false)

    const first = applyHit(state, transformAt(0, 0, 0))
    assert.equal(first.error, undefined)
    state = first.state
    assert.equal(state.phase, 'width-b')
    assert.equal(measureHint(state.phase), '再点击地面第二点，完成长度')

    const zero = applyHit(state, transformAt(0, 0, 0))
    assert.equal(zero.error, 'no-distance')
    assert.equal(zero.state.phase, 'width-b')

    const width = applyHit(state, transformAt(4, 0, 0))
    state = width.state
    assert.equal(state.widthMm, 4000)
    assert.equal(state.phase, 'depth-a')
    assert.equal(measureHint(state.phase), '点击地面第一点，测量宽度')

    state = applyHit(state, transformAt(0, 0, 0)).state
    state = applyHit(state, transformAt(0, 0, 3)).state
    assert.equal(state.depthMm, 3000)
    assert.equal(state.phase, 'height')
    assert.equal(measureHint(state.phase), '确认层高后保存')
    assert.equal(canSaveMeasure(state), true)
  })
})

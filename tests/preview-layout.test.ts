import assert from 'node:assert/strict'
import test from 'node:test'
import type { Product } from '../src/types/domain.ts'
import {
  DEFAULT_ROOM_DEPTH_MM,
  DEFAULT_ROOM_HEIGHT_MM,
  DEFAULT_ROOM_WIDTH_MM,
  LAYOUT_GAP_MM,
  LAYOUT_INSET_MM,
  furnitureToXrCubes,
  layoutFurniture,
  mmToMeters,
  moveFurniture,
  resolvePreviewRoom,
  roomFloorScale,
} from '../src/utils/previewLayout.ts'

function product(
  id: string,
  sizeMm: { w: number; d: number; h: number },
): Product {
  return {
    id,
    name: id,
    category: 'other',
    rooms: ['living'],
    style: 'modern',
    priceFen: 1,
    coverUrl: 'https://example.com/x.jpg',
    imageUrls: [],
    sizeMm,
    material: 'x',
    description: 'x',
  }
}

test('resolvePreviewRoom uses scan when positive, otherwise 4000x3000', () => {
  assert.deepEqual(resolvePreviewRoom(null), {
    widthMm: DEFAULT_ROOM_WIDTH_MM,
    depthMm: DEFAULT_ROOM_DEPTH_MM,
    heightMm: DEFAULT_ROOM_HEIGHT_MM,
  })
  assert.equal(DEFAULT_ROOM_WIDTH_MM, 4000)
  assert.equal(DEFAULT_ROOM_DEPTH_MM, 3000)
  assert.equal(DEFAULT_ROOM_HEIGHT_MM, 2800)
  assert.deepEqual(
    resolvePreviewRoom({ widthMm: 5000, depthMm: 3500, heightMm: 2900 }),
    { widthMm: 5000, depthMm: 3500, heightMm: 2900 },
  )
  assert.deepEqual(
    resolvePreviewRoom({ widthMm: 0, depthMm: 3500, heightMm: 2900 }),
    { widthMm: 4000, depthMm: 3000, heightMm: 2800 },
  )
})

test('layoutFurniture places along the long width edge and wraps', () => {
  assert.equal(LAYOUT_INSET_MM, 100)
  assert.equal(LAYOUT_GAP_MM, 100)
  const placed = layoutFurniture(
    { widthMm: 4000, depthMm: 3000 },
    [
      product('sofa', { w: 2200, d: 980, h: 820 }),
      product('table', { w: 1400, d: 800, h: 750 }),
      product('lamp', { w: 500, d: 500, h: 120 }),
    ],
  )
  assert.deepEqual(
    placed.map((item) => [item.productId, item.xMm, item.yMm, item.wMm, item.dMm]),
    [
      ['sofa', 100, 100, 2200, 980],
      ['table', 2400, 100, 1400, 800],
      ['lamp', 100, 1180, 500, 500],
    ],
  )
})

test('layoutFurniture follows depth when it is the long edge', () => {
  const placed = layoutFurniture(
    { widthMm: 2000, depthMm: 4000 },
    [
      product('a', { w: 800, d: 1800, h: 100 }),
      product('b', { w: 800, d: 1800, h: 100 }),
    ],
  )
  assert.deepEqual(
    placed.map((item) => [item.productId, item.xMm, item.yMm]),
    [
      ['a', 100, 100],
      ['b', 100, 2000],
    ],
  )
})

test('moveFurniture clamps inside the room and does not persist', () => {
  const start = layoutFurniture({ widthMm: 4000, depthMm: 3000 }, [
    product('sofa', { w: 2200, d: 980, h: 820 }),
  ])
  const moved = moveFurniture(start, 'sofa', 9000, -40, { widthMm: 4000, depthMm: 3000 })
  assert.equal(moved[0]?.xMm, 1800)
  assert.equal(moved[0]?.yMm, 0)
  assert.deepEqual(start[0]?.xMm, 100)
})

test('furnitureToXrCubes converts mm to meters around room center', () => {
  assert.equal(mmToMeters(2200), 2.2)
  const room = { widthMm: 4000, depthMm: 3000, heightMm: 2800 }
  const placed = [
    {
      productId: 'sofa',
      xMm: 100,
      yMm: 100,
      wMm: 2200,
      dMm: 980,
      hMm: 820,
    },
  ]
  assert.deepEqual(furnitureToXrCubes(room, placed), [
    {
      id: 'sofa',
      position: '-0.8 0.41 -0.91',
      scale: '2.2 0.82 0.98',
    },
  ])
  assert.equal(roomFloorScale(room), '4 1 3')
})

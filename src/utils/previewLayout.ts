import type { Product, RoomScan } from '../types/domain'

export const DEFAULT_ROOM_WIDTH_MM = 4000
export const DEFAULT_ROOM_DEPTH_MM = 3000
export const DEFAULT_ROOM_HEIGHT_MM = 2800
export const LAYOUT_INSET_MM = 100
export const LAYOUT_GAP_MM = 100

export type PreviewRoomMm = {
  widthMm: number
  depthMm: number
  heightMm: number
}

export type PlacedFurniture = {
  productId: string
  xMm: number
  yMm: number
  wMm: number
  dMm: number
  hMm: number
}

export type XrCubePose = {
  id: string
  position: string
  scale: string
}

export function resolvePreviewRoom(
  scan?: Pick<RoomScan, 'widthMm' | 'depthMm' | 'heightMm'> | null,
): PreviewRoomMm {
  if (
    scan &&
    Number.isFinite(scan.widthMm) &&
    scan.widthMm > 0 &&
    Number.isFinite(scan.depthMm) &&
    scan.depthMm > 0
  ) {
    return {
      widthMm: scan.widthMm,
      depthMm: scan.depthMm,
      heightMm:
        Number.isFinite(scan.heightMm) && scan.heightMm > 0
          ? scan.heightMm
          : DEFAULT_ROOM_HEIGHT_MM,
    }
  }
  return {
    widthMm: DEFAULT_ROOM_WIDTH_MM,
    depthMm: DEFAULT_ROOM_DEPTH_MM,
    heightMm: DEFAULT_ROOM_HEIGHT_MM,
  }
}

export function layoutFurniture(
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
  products: readonly Product[],
): PlacedFurniture[] {
  const alongWidth = room.widthMm >= room.depthMm
  const innerPrimary = Math.max(0, (alongWidth ? room.widthMm : room.depthMm) - LAYOUT_INSET_MM * 2)
  const result: PlacedFurniture[] = []
  let cursorPrimary = LAYOUT_INSET_MM
  let cursorCross = LAYOUT_INSET_MM
  let rowCross = 0

  for (const product of products) {
    const wMm = product.sizeMm.w
    const dMm = product.sizeMm.d
    const primarySize = alongWidth ? wMm : dMm
    const crossSize = alongWidth ? dMm : wMm
    const wouldOverflow =
      cursorPrimary > LAYOUT_INSET_MM &&
      cursorPrimary + primarySize > LAYOUT_INSET_MM + innerPrimary
    if (wouldOverflow) {
      cursorPrimary = LAYOUT_INSET_MM
      cursorCross += rowCross + LAYOUT_GAP_MM
      rowCross = 0
    }
    result.push({
      productId: product.id,
      xMm: alongWidth ? cursorPrimary : cursorCross,
      yMm: alongWidth ? cursorCross : cursorPrimary,
      wMm,
      dMm,
      hMm: product.sizeMm.h,
    })
    cursorPrimary += primarySize + LAYOUT_GAP_MM
    rowCross = Math.max(rowCross, crossSize)
  }
  return result
}

export function clampPlacedFurniture(
  item: PlacedFurniture,
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
): PlacedFurniture {
  const maxX = Math.max(0, room.widthMm - item.wMm)
  const maxY = Math.max(0, room.depthMm - item.dMm)
  return {
    ...item,
    xMm: Math.min(Math.max(0, item.xMm), maxX),
    yMm: Math.min(Math.max(0, item.yMm), maxY),
  }
}

export function moveFurniture(
  items: readonly PlacedFurniture[],
  productId: string,
  xMm: number,
  yMm: number,
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
): PlacedFurniture[] {
  return items.map((item) =>
    item.productId === productId ? clampPlacedFurniture({ ...item, xMm, yMm }, room) : item,
  )
}

export function mmToMeters(mm: number): number {
  return mm / 1000
}

function fmtMeters(mm: number): string {
  const meters = mmToMeters(mm)
  return String(Math.round(meters * 1000) / 1000)
}

export function furnitureToXrCubes(
  room: PreviewRoomMm,
  placed: readonly PlacedFurniture[],
): XrCubePose[] {
  const roomW = room.widthMm
  const roomD = room.depthMm
  return placed.map((item) => {
    const xMm = item.xMm + item.wMm / 2 - roomW / 2
    const yMm = item.hMm / 2
    const zMm = item.yMm + item.dMm / 2 - roomD / 2
    return {
      id: item.productId,
      position: `${fmtMeters(xMm)} ${fmtMeters(yMm)} ${fmtMeters(zMm)}`,
      scale: `${fmtMeters(item.wMm)} ${fmtMeters(item.hMm)} ${fmtMeters(item.dMm)}`,
    }
  })
}

export function roomFloorScale(room: PreviewRoomMm): string {
  return `${fmtMeters(room.widthMm)} 1 ${fmtMeters(room.depthMm)}`
}

export function isFurnitureInRoom(
  item: PlacedFurniture,
  room: Pick<PreviewRoomMm, 'widthMm' | 'depthMm'>,
): boolean {
  return item.xMm >= 0 && item.yMm >= 0 &&
    item.xMm + item.wMm <= room.widthMm && item.yMm + item.dMm <= room.depthMm
}

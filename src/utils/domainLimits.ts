// Generous residential project bounds, shared by input and persistence boundaries.
export const MAX_AREA_M2 = 10000
export const MAX_SCAN_DIMENSION_MM = 100000

export function isValidArea(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AREA_M2
}

export function isValidScanDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_SCAN_DIMENSION_MM
}

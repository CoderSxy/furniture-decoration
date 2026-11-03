export function fitFloorplanSize(
  widthMm: number,
  depthMm: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (!(widthMm > 0) || !(depthMm > 0) || !(maxWidth > 0) || !(maxHeight > 0)) {
    return { width: 0, height: 0 }
  }
  const scale = Math.min(maxWidth / widthMm, maxHeight / depthMm)
  return {
    width: Math.max(1, Math.round(widthMm * scale)),
    height: Math.max(1, Math.round(depthMm * scale)),
  }
}

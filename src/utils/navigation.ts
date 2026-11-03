export function productDetailUrl(productId: string): string {
  return `/pages/catalog/detail?productId=${encodeURIComponent(productId)}`
}

export function planDetailUrl(planId: string): string {
  return `/pages/plans/detail?planId=${encodeURIComponent(planId)}`
}

export function scanPageUrl(planId: string): string {
  return `/packageScan/pages/scan/index?planId=${encodeURIComponent(planId)}`
}

export function aiRecommendUrl(planId: string): string {
  return `/packagePreview/pages/ai/recommend?planId=${encodeURIComponent(planId)}`
}

export function previewPageUrl(planId: string): string {
  return `/packagePreview/pages/preview/index?planId=${encodeURIComponent(planId)}`
}

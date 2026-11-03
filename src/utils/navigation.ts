export function productDetailUrl(productId: string): string {
  return `/pages/catalog/detail?productId=${encodeURIComponent(productId)}`
}

export function planDetailUrl(planId: string): string {
  return `/pages/plans/detail?planId=${encodeURIComponent(planId)}`
}

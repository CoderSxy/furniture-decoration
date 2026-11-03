export function productDetailUrl(productId: string): string {
  return `/pages/catalog/detail?productId=${encodeURIComponent(productId)}`
}

const taro = {
  request: async () => ({ data: [] }),
  getSystemInfoSync: () => ({ SDKVersion: '0.0.0' }),
}

export default taro

export const useRouter = () => ({ params: { planId: taro.testPlanId ?? '' } })
taro.nextTick = (cb) => cb()
taro.onWindowResize = () => {}
taro.offWindowResize = () => {}
taro.createSelectorQuery = () => {
  const query = { select: () => query, boundingClientRect: () => query, exec: (cb) => cb([{ width: 320, height: 240, left: 0, top: 0 }]) }
  return query
}
taro.getSystemInfoSync = () => ({ SDKVersion: '3.6.5' })
export const useReady = (cb) => { taro.testReady = cb }
export const useDidShow = (cb) => { taro.testShow = cb }
export const useDidHide = (cb) => { taro.testHide = cb }

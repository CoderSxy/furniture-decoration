import Taro from '@tarojs/taro'
import { useEffect, useId, useState } from 'react'

// Selector results and touch coordinates both use physical CSS pixels.
export function useContainerWidth() {
  const id = `container-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [width, setWidth] = useState(0)
  useEffect(() => {
    let cancelled = false
    const measure = () => {
      Taro.nextTick(() => {
        if (cancelled) return
        Taro.createSelectorQuery().select(`#${id}`).boundingClientRect().exec((results) => {
          const rect = results?.[0] as { width?: number } | undefined
          if (!cancelled && rect?.width && rect.width > 0) setWidth(rect.width)
        })
      })
    }
    measure()
    Taro.onWindowResize(measure)
    return () => {
      cancelled = true
      Taro.offWindowResize(measure)
    }
  }, [id])
  return { id, width }
}

import Taro, { useDidShow, useReady } from '@tarojs/taro'
import { useEffect, useId, useRef, useState } from 'react'

const MAX_ATTEMPTS = 6
const RETRY_MS = 100

// Selector results and touch coordinates both use physical CSS pixels.
export function useContainerWidth() {
  const id = `container-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [width, setWidth] = useState(0)
  const restart = useRef<() => void>(() => {})
  useReady(() => restart.current())
  useDidShow(() => restart.current())
  useEffect(() => {
    let cancelled = false
    let generation = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      clearTimeout(timer)
      const current = ++generation
      let attempts = 0
      const measure = () => {
        attempts++
        Taro.nextTick(() => {
          if (cancelled || current !== generation) return
          Taro.createSelectorQuery().select(`#${id}`).boundingClientRect().exec((results) => {
            if (cancelled || current !== generation) return
            const rect = results?.[0] as { width?: number } | undefined
            if (typeof rect?.width === 'number' && Number.isFinite(rect.width) && rect.width > 0) {
              setWidth(rect.width)
            } else if (attempts < MAX_ATTEMPTS) {
              timer = setTimeout(measure, RETRY_MS)
            }
          })
        })
      }
      measure()
    }
    restart.current = start
    start() // Also covers components mounted after page ready.
    Taro.onWindowResize(start)
    return () => {
      cancelled = true
      clearTimeout(timer)
      restart.current = () => {}
      Taro.offWindowResize(start)
    }
  }, [id])
  return { id, width, remeasure: () => restart.current() }
}

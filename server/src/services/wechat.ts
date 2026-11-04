import type { Env } from '../env.ts'
import type { WechatPort } from '../db/ports.ts'

export function createWechat(env: Env): WechatPort {
  return {
    async code2Session(code) {
      const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
      url.searchParams.set('appid', env.WECHAT_APPID)
      url.searchParams.set('secret', env.WECHAT_APPSECRET)
      url.searchParams.set('js_code', code)
      url.searchParams.set('grant_type', 'authorization_code')
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 5000)
      try {
        const res = await fetch(url, { signal: ac.signal })
        if (res.status >= 500) return { errcode: -1, httpStatus: res.status }
        const json = (await res.json()) as { openid?: string; errcode?: number }
        if (typeof json.openid === 'string' && json.openid.length > 0) {
          return { openid: json.openid }
        }
        return { errcode: json.errcode ?? -1, httpStatus: res.status }
      } catch {
        return { errcode: -1, httpStatus: 503 }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

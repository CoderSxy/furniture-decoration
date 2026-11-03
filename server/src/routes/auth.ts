import Router from '@koa/router'
import type { AppDeps } from '../db/ports.ts'
import { ApiError } from '../errors.ts'
import { hitRateLimit, loginRateKey } from '../services/rateLimit.ts'
import { SESSION_TTL_SECONDS, createSessionToken, encodeSid, sessionKey } from '../services/session.ts'

function clientIp(ctx: { ip: string; get: (h: string) => string }): string {
  const forwarded = ctx.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return ctx.ip || '0.0.0.0'
}

export function registerAuth(router: Router): void {
  router.post('/api/auth/login', async (ctx) => {
    const deps = ctx.state.deps as AppDeps
    const body = ctx.request.body as { code?: unknown }
    const code = body?.code
    if (typeof code !== 'string' || code.length === 0 || code.length > 128) {
      throw new ApiError(401, 'INVALID_CODE', '登录已过期，请再点一次')
    }
    await hitRateLimit(deps.redis, loginRateKey(clientIp(ctx)), 20, 60)
    const wx = await deps.wechat.code2Session(code)
    if ('openid' in wx) {
      const now = deps.clock()
      const user = await deps.mysql.upsertUserByOpenid(wx.openid, now, deps.uuid())
      const sid = encodeSid(deps.randomBytes(32))
      const token = createSessionToken(deps.env.SESSION_SECRET, sid)
      await deps.redis.set(sessionKey(sid), JSON.stringify({ userId: user.id }), SESSION_TTL_SECONDS)
      ctx.status = 200
      ctx.body = { token, expiresIn: SESSION_TTL_SECONDS, user: { id: user.id } }
      return
    }
    if (wx.httpStatus != null && wx.httpStatus >= 500) {
      throw new ApiError(502, 'WECHAT_UNAVAILABLE', '登录失败，请重试')
    }
    if (wx.errcode === -1) {
      throw new ApiError(502, 'WECHAT_UNAVAILABLE', '登录失败，请重试')
    }
    throw new ApiError(401, 'INVALID_CODE', '登录已过期，请再点一次')
  })
  // 本函数禁止 console.log code / token / openid / AppSecret；需要排障时只记 user.id 与微信 errcode。

  router.post('/api/auth/logout', async (ctx) => {
    ctx.status = 401
    ctx.body = { error: { code: 'UNAUTHORIZED', message: '请重新登录' } }
  })
}

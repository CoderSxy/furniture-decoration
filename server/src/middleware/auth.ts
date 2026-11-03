import type { Context, Next } from 'koa'
import type { AppDeps } from '../db/ports.ts'
import { ApiError } from '../errors.ts'
import { SESSION_TTL_SECONDS, sessionKey, verifySessionToken } from '../services/session.ts'

export async function requireAuth(ctx: Context, next: Next): Promise<void> {
  const deps = ctx.state.deps as AppDeps
  const header = ctx.get('authorization')
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  const token = header.slice(prefix.length).trim()
  const sid = verifySessionToken(deps.env.SESSION_SECRET, token)
  if (sid == null) throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  const raw = await deps.redis.get(sessionKey(sid))
  if (raw == null) throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  let userId = ''
  try {
    userId = JSON.parse(raw).userId
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ApiError(401, 'UNAUTHORIZED', '请重新登录')
  }
  await deps.redis.expire(sessionKey(sid), SESSION_TTL_SECONDS)
  ctx.state.userId = userId
  ctx.state.sid = sid
  await next()
}

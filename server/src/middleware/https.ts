import type { Context, Next } from 'koa'
import { ApiError } from '../errors.ts'
import type { AppDeps } from '../db/ports.ts'

export async function httpsGuard(ctx: Context, next: Next): Promise<void> {
  const deps = ctx.state.deps as AppDeps
  if (deps.env.NODE_ENV !== 'production') {
    await next()
    return
  }
  if (ctx.path === '/api/health') {
    await next()
    return
  }
  const proto = ctx.get('x-forwarded-proto')
  if (proto !== 'https') {
    throw new ApiError(400, 'VALIDATION_ERROR', '生产环境只允许 HTTPS')
  }
  await next()
}

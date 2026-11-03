import type { Context, Next } from 'koa'
import { ApiError, errorBody } from '../errors.ts'

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next()
  } catch (error) {
    if (error instanceof ApiError) {
      ctx.status = error.status
      ctx.body = errorBody(error.code, error.message)
      return
    }
    const status = typeof error === 'object' && error != null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : 500
    if (status === 413) {
      ctx.status = 413
      ctx.body = errorBody('PAYLOAD_TOO_LARGE', '请求体过大')
      return
    }
    ctx.status = 500
    ctx.body = errorBody('INTERNAL', '服务器错误')
  }
}

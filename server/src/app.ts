import Koa from 'koa'
import Router from '@koa/router'
import { bodyParser } from '@koa/bodyparser'
import type { AppDeps } from './db/ports.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { httpsGuard } from './middleware/https.ts'
import { requireAuth } from './middleware/auth.ts'
import { registerAuth } from './routes/auth.ts'
import { registerHealth } from './routes/health.ts'

export function createApp(deps: AppDeps): Koa {
  const app = new Koa()
  app.use(async (ctx, next) => {
    ctx.state.deps = deps
    await next()
  })
  app.use(errorHandler)
  app.use(httpsGuard)
  app.use(
    bodyParser({
      jsonLimit: '512kb',
      enableTypes: ['json'],
    }),
  )
  const router = new Router()
  registerHealth(router)
  registerAuth(router)
  router.get('/api/sync', requireAuth, (ctx) => {
    ctx.status = 404
    ctx.body = { error: { code: 'INTERNAL', message: '服务器错误' } }
  })
  router.put('/api/sync', requireAuth, (ctx) => {
    ctx.status = 404
    ctx.body = { error: { code: 'INTERNAL', message: '服务器错误' } }
  })
  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}

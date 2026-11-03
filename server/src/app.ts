import Koa from 'koa'
import Router from '@koa/router'
import { bodyParser } from '@koa/bodyparser'
import type { AppDeps } from './db/ports.ts'
import { errorHandler } from './middleware/errorHandler.ts'
import { httpsGuard } from './middleware/https.ts'
import { registerAuth } from './routes/auth.ts'
import { registerHealth } from './routes/health.ts'
import { registerSync } from './routes/sync.ts'

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
  registerSync(router)
  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}

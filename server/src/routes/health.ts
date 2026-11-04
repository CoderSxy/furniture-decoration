import Router from '@koa/router'

export function registerHealth(router: Router): void {
  router.get('/api/health', (ctx) => {
    ctx.status = 200
    ctx.body = { ok: true }
  })
}

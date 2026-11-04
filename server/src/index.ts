import { createApp } from './app.ts'
import { createMysql } from './db/mysql.ts'
import { createRedis } from './db/redis.ts'
import { loadEnv } from './env.ts'
import { createWechat } from './services/wechat.ts'
import { randomBytes, randomUUID } from 'node:crypto'

function fail(): never {
  console.error('missing env')
  process.exit(1)
}

let env
try {
  env = loadEnv(process.env)
} catch {
  fail()
}

const app = createApp({
  env,
  mysql: createMysql(env),
  redis: createRedis(env),
  wechat: createWechat(env),
  clock: () => new Date(),
  randomBytes,
  uuid: () => randomUUID(),
})

app.listen(env.PORT, () => {
  console.log(`listening on ${env.PORT}`)
})

import type { Env } from '../env.ts'
import type { WechatPort } from '../db/ports.ts'

export function createWechat(env: Env): WechatPort {
  return {
    async code2Session() {
      void env
      return { errcode: -1 }
    },
  }
}

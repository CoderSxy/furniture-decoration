import { loadEnv } from './env.ts'

try {
  loadEnv(process.env)
} catch (error) {
  const text = error instanceof Error ? error.message : 'missing env'
  console.error(text.startsWith('missing env') ? 'missing env' : 'missing env')
  process.exit(1)
}

console.error('server bootstrap continues in later tasks')

import { CLOCK_SKEW_MS } from '../domain/enums.ts'

export function clampUpdatedAt(client: Date, serverNow: Date): Date {
  if (client.getTime() - serverNow.getTime() > CLOCK_SKEW_MS) return serverNow
  return client
}

export function shouldTakeIncoming(incoming: Date, existing: Date | null): boolean {
  if (existing == null) return true
  return incoming.getTime() > existing.getTime()
}

export function parseIso(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function toIso(date: Date): string {
  return date.toISOString()
}

export type SyncKind = 'favorite' | 'plan' | 'budget' | 'scan' | 'aiPreview' | 'preference'

export type SyncItem = {
  kind: SyncKind
  itemId: string
  updatedAt: string
  deleted: boolean
  payload: unknown | null
}

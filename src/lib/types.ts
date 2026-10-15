export type User = { id: string; email: string }
export type Branch = { id: string; name: string; timeZone: string }
export type AuditEvent = {
  branchId: string
  code: string
  outcome: 'success' | 'failure'
  occurredAt: string
  contractVersion: number
}
export type AuditFilters = {
  branchIds: string[]
  code: string
  outcome: '' | 'success' | 'failure'
  from: string
  to: string
  page: number
}
export type AuditPage = { rows: AuditEvent[]; total: number }

export interface Gateway {
  getUser(): Promise<User | null>
  onAuthChange(callback: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  branches(userId: string): Promise<Branch[]>
  audit(filters: AuditFilters): Promise<AuditPage>
}

export class AccessError extends Error {}

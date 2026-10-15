import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AccessError, type AuditFilters, type AuditPage, type Branch, type Gateway, type User } from './types'

export const PAGE_SIZE = 12

function check(error: { message: string; code?: string; status?: number } | null) {
  if (!error) return
  if (error.status === 401 || error.status === 403 || error.code === '42501') throw new AccessError('Acceso denegado por la política de seguridad.')
  throw new Error(error.message)
}

export function createGateway(url: string | undefined, key: string | undefined): Gateway | null {
  if (!url || !key) return null
  if (key.startsWith('sb_secret_')) return null
  // Defense against accidentally pasting a legacy service_role JWT into a VITE_* variable.
  if (key.split('.').length === 3) {
    try { if (JSON.parse(atob(key.split('.')[1])).role !== 'anon') return null } catch { return null }
  }
  let parsed: URL
  try { parsed = new URL(url) } catch { return null }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null
  const client = createClient(parsed.toString(), key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  return supabaseGateway(client)
}

export function supabaseGateway(client: SupabaseClient): Gateway {
  return {
    async getUser(): Promise<User | null> {
      // getUser validates the JWT with Auth; do not trust locally cached getSession() as authorization.
      const { data, error } = await client.auth.getUser()
      if (error) {
        if (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError') return null
        throw error
      }
      return data.user ? { id: data.user.id, email: data.user.email ?? 'Cuenta' } : null
    },
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange(() => callback())
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      check(error)
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      check(error)
    },
    async branches(userId): Promise<Branch[]> {
      const { data: memberships, error: membershipError } = await client.from('branch_users')
        .select('branch_id').eq('user_id', userId)
      check(membershipError)
      const ids = [...new Set((memberships ?? []).map(row => row.branch_id as string))]
      if (!ids.length) return []
      const { data, error } = await client.from('branches').select('id,name,time_zone').in('id', ids).order('name')
      check(error)
      // Incomplete assignment visibility is not a license to display a partial authorization set.
      if ((data ?? []).length !== ids.length || (data ?? []).some(row => !ids.includes(row.id))) {
        throw new AccessError('No se pudieron verificar todas las sucursales asignadas.')
      }
      return (data ?? []).map(row => ({ id: row.id, name: row.name, timeZone: row.time_zone }))
    },
    async audit(filters: AuditFilters): Promise<AuditPage> {
      if (!filters.branchIds.length) return { rows: [], total: 0 }
      let query = client.from('branch_audit_events')
        .select('branch_id,event_code,outcome,occurred_at,contract_version', { count: 'exact' })
        .in('branch_id', filters.branchIds)
        .order('occurred_at', { ascending: false })
        .order('branch_id', { ascending: true })
        .order('event_code', { ascending: true })
        .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1)
      if (filters.code) query = query.eq('event_code', filters.code)
      if (filters.outcome) query = query.eq('outcome', filters.outcome)
      if (filters.from) query = query.gte('occurred_at', new Date(`${filters.from}T00:00:00`).toISOString())
      if (filters.to) {
        const nextDay = new Date(`${filters.to}T00:00:00`)
        nextDay.setDate(nextDay.getDate() + 1) // calendar day, not 24 hours across DST changes
        query = query.lt('occurred_at', nextDay.toISOString())
      }
      const { data, error, count } = await query
      check(error)
      return {
        rows: (data ?? []).map(row => ({ branchId: row.branch_id, code: row.event_code,
          outcome: row.outcome as 'success' | 'failure', occurredAt: row.occurred_at,
          contractVersion: row.contract_version })),
        total: count ?? 0,
      }
    },
  }
}

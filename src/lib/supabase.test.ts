import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createGateway, PAGE_SIZE, supabaseGateway } from './supabase'

function query(rows: unknown[], count = rows.length) {
  const q = {
    select: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q),
    order: vi.fn(() => q), range: vi.fn(() => q), gte: vi.fn(() => q), lt: vi.fn(() => q),
    then: (resolve: (value: unknown) => void) => Promise.resolve(resolve({ data: rows, count, error: null })),
  }
  return q
}

describe('adaptador FC-07', () => {
  it('pide instalaciones solo con JWT actual y sin claves privilegiadas en el navegador', async () => {
    const getSession = vi.fn(async () => ({ data: { session: { access_token: 'jwt-ficticio' } }, error: null }))
    const client = { auth: { getSession } } as unknown as SupabaseClient
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ installations: ['a'] }), { status: 200 }))
    const gateway = supabaseGateway(client, 'https://example.test', 'sb_publishable_public')
    expect(await gateway.installations!('a')).toEqual(['a'])
    expect(fetcher).toHaveBeenCalledWith('https://example.test/functions/v1/branch-bridge/installations?branchId=a',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer jwt-ficticio', apikey: 'sb_publishable_public' }) }))
    fetcher.mockRestore()
  })
  it('no envía actualización con sesión ausente o expirada', async () => {
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } } as unknown as SupabaseClient
    const fetcher = vi.spyOn(globalThis, 'fetch')
    await expect(supabaseGateway(client, 'https://example.test', 'sb_publishable_public').refresh!('a', 'i', 'k')).rejects.toThrow('Sesión vencida')
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockRestore()
  })
  it('no inicializa sin configuración ni con una clave secreta', () => {
    expect(createGateway(undefined, undefined)).toBeNull()
    expect(createGateway('https://example.test', 'sb_secret_private')).toBeNull()
    const jwt = ['e30', btoa(JSON.stringify({ role: 'service_role' })), 'firma'].join('.')
    expect(createGateway('https://example.test', jwt)).toBeNull()
    expect(createGateway('http://example.test', 'sb_publishable_public')).toBeNull()
  })
  it('consulta asignaciones propias, únicamente columnas permitidas y verifica ids', async () => {
    const membership = query([{ branch_id: 'a' }])
    const branches = query([{ id: 'a', name: 'Norte', time_zone: 'America/Argentina/Buenos_Aires' }])
    const client = { from: vi.fn(name => name === 'branch_users' ? membership : branches) } as unknown as SupabaseClient
    const gateway = supabaseGateway(client)
    expect(await gateway.branches('usuario')).toEqual([{ id: 'a', name: 'Norte', timeZone: 'America/Argentina/Buenos_Aires' }])
    expect(membership.select).toHaveBeenCalledWith('branch_id')
    expect(membership.eq).toHaveBeenCalledWith('user_id', 'usuario')
    expect(branches.select).toHaveBeenCalledWith('id,name,time_zone')
    expect(branches.in).toHaveBeenCalledWith('id', ['a'])
    expect(client.from).not.toHaveBeenCalledWith('branch_installations')
  })
  it('no consulta sucursales si no existen asignaciones', async () => {
    const q = query([])
    const client = { from: vi.fn(() => q) } as unknown as SupabaseClient
    expect(await supabaseGateway(client).branches('usuario')).toEqual([])
    expect(client.from).toHaveBeenCalledTimes(1)
  })
  it('auditoría usa proyección minimizada, aislamiento y paginación server-side', async () => {
    const q = query([{ branch_id: 'a', event_code: 'tipo_prueba', outcome: 'success', occurred_at: '2026-10-14T12:00:00Z', contract_version: 1 }], 20)
    const client = { from: vi.fn(() => q) } as unknown as SupabaseClient
    const result = await supabaseGateway(client).audit({ branchIds: ['a'], code: 'tipo_prueba', outcome: 'success', from: '', to: '', page: 2 })
    expect(client.from).toHaveBeenCalledWith('branch_audit_events')
    expect(q.select).toHaveBeenCalledWith('branch_id,event_code,outcome,occurred_at,contract_version', { count: 'exact' })
    expect(q.in).toHaveBeenCalledWith('branch_id', ['a'])
    expect(q.eq).toHaveBeenCalledWith('event_code', 'tipo_prueba')
    expect(q.range).toHaveBeenCalledWith(PAGE_SIZE, PAGE_SIZE * 2 - 1)
    expect(result.rows[0]).not.toHaveProperty('originInstallationId')
    expect(result.total).toBe(20)
  })
})

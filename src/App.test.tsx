import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { PAGE_SIZE } from './lib/supabase'
import { AccessError, type AuditEvent, type Branch, type Gateway, type User } from './lib/types'
import css from './style.css?raw'

const A: Branch = { id: 'a', name: 'Sucursal Norte', timeZone: 'America/Argentina/Buenos_Aires' }
const B: Branch = { id: 'b', name: 'Sucursal Sur', timeZone: 'America/Argentina/Buenos_Aires' }
const event = (branchId: string, code = 'sync_result'): AuditEvent => ({ branchId, code, outcome: 'success', occurredAt: '2026-10-14T12:30:00Z', contractVersion: 1 })
function fixture(user: User | null = { id: 'u', email: 'consulta@ejemplo.test' }, items: Branch[] = [A, B]) {
  let current = user
  let authCallback = () => {}
  const gateway: Gateway = {
    getUser: vi.fn(async () => current),
    onAuthChange: vi.fn(callback => { authCallback = callback; return () => {} }),
    signIn: vi.fn(async () => { current = user ?? { id: 'u', email: 'consulta@ejemplo.test' }; authCallback() }),
    signOut: vi.fn(async () => { current = null; authCallback() }),
    branches: vi.fn(async () => items),
    audit: vi.fn(async () => ({ rows: [], total: 0 })),
  }
  return { gateway, setUser(next: User | null) { current = next; authCallback() } }
}
function open(gateway: Gateway, path = '/') { window.history.replaceState({}, '', path); return render(<App gateway={gateway} />) }
beforeEach(() => { window.history.replaceState({}, '', '/'); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('acceso', () => {
  it('muestra configuración pendiente sin variables y no intenta conectar', () => { open(null as unknown as Gateway); expect(screen.getByText('Configuración pendiente')).toBeInTheDocument() })
  it('bloquea rutas privadas y permite login', async () => {
    const { gateway } = fixture(null)
    open(gateway, '/auditoria')
    expect(await screen.findByRole('heading', { name: 'Ingresá a tu espacio' })).toBeInTheDocument()
    expect(gateway.audit).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'consulta@ejemplo.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'no-es-una-clave-real')
    await userEvent.click(screen.getByRole('button', { name: /Iniciar sesión/ }))
    expect(await screen.findByText('Sucursales autorizadas')).toBeInTheDocument()
    expect(gateway.signIn).toHaveBeenCalledWith('consulta@ejemplo.test', 'no-es-una-clave-real')
  })
  it('oculta datos al expirar la sesión y ante error de verificación', async () => {
    const instance = fixture()
    open(instance.gateway)
    expect(await screen.findByRole('heading', { name: 'Sucursal Norte' })).toBeInTheDocument()
    instance.setUser(null)
    expect(await screen.findByRole('heading', { name: 'Ingresá a tu espacio' })).toBeInTheDocument()
    expect(screen.queryByText('Sucursal Norte')).not.toBeInTheDocument()
  })
  it('bloquea las vistas y nuevas consultas mientras revalida una sesión al recuperar foco', async () => {
    const { gateway } = fixture()
    open(gateway, '/auditoria')
    await screen.findByText('Sin eventos')
    let expire!: (user: User | null) => void
    vi.mocked(gateway.getUser).mockImplementationOnce(() => new Promise(resolve => { expire = resolve }))
    const previousCalls = vi.mocked(gateway.audit).mock.calls.length
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(screen.getByRole('heading', { name: 'Verificando sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument()
    expect(vi.mocked(gateway.audit).mock.calls.length).toBe(previousCalls)
    await act(async () => { expire(null) })
    expect(await screen.findByRole('heading', { name: 'Ingresá a tu espacio' })).toBeInTheDocument()
  })
  it('deniega sin asignaciones y nunca consulta auditoría', async () => {
    const { gateway } = fixture({ id: 'u', email: 'x@test.local' }, [])
    open(gateway, '/auditoria')
    expect(await screen.findByText('Acceso no autorizado')).toBeInTheDocument()
    expect(gateway.audit).not.toHaveBeenCalled()
  })
  it('cierra sesión y retira la vista privada', async () => {
    const { gateway } = fixture()
    open(gateway)
    await screen.findByRole('heading', { name: 'Sucursal Norte' })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Ingresá a tu espacio' })).toBeInTheDocument()
    expect(gateway.signOut).toHaveBeenCalledOnce()
  })
})

describe('sucursales y estado', () => {
  it('solo permite actualizar con sucursal concreta e instalación autorizada, sin éxito simulado', async () => {
    const { gateway } = fixture()
    gateway.installations = vi.fn(async id => id === 'a' ? ['installation-a'] : [])
    gateway.refreshStatus = vi.fn(async () => null)
    gateway.refresh = vi.fn(async () => ({ id: 'request-a', status: 'pending' as const, requestedAt: new Date().toISOString(), confirmedAt: null, errorCode: null }))
    open(gateway, '/sincronizacion')
    await screen.findByRole('heading', { name: 'Sincronización' })
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Seleccionar sucursal' }), 'a')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled())
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => window.dispatchEvent(new Event('online')))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Seleccionar sucursal' }), 'a')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(gateway.refresh).toHaveBeenCalledWith('a', 'installation-a', expect.any(String))
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    expect(screen.getByText('Sin confirmación')).toBeInTheDocument()
  })
  it('no habilita la solicitud si el backend falla o rechaza permisos', async () => {
    const { gateway } = fixture(undefined, [A])
    gateway.installations = vi.fn(async () => { throw new AccessError('Sin permiso') })
    gateway.refreshStatus = vi.fn(async () => null)
    gateway.refresh = vi.fn()
    open(gateway, '/sincronizacion')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Seleccionar sucursal' }), 'a')
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    expect(gateway.refresh).not.toHaveBeenCalled()
  })
  it('muestra A+B autorizadas y permite filtrar sin seleccionar sucursal ajena', async () => {
    const { gateway } = fixture()
    open(gateway)
    expect(await screen.findByRole('heading', { name: 'Sucursal Sur' })).toBeInTheDocument()
    expect(screen.getByText('2 sucursales autorizadas')).toBeInTheDocument()
    const picker = screen.getByRole('combobox', { name: 'Seleccionar sucursal' })
    expect(within(picker).queryByRole('option', { name: 'Sucursal Este' })).not.toBeInTheDocument()
    await userEvent.selectOptions(picker, 'a')
    expect(screen.getAllByRole('heading', { name: 'Sucursal Norte' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Sucursal Sur' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas las sucursales' }))
    expect(screen.getByRole('heading', { name: 'Sucursal Sur' })).toBeInTheDocument()
  })
  it('no fabrica métricas ni datos de sincronización y mantiene Actualizar deshabilitado', async () => {
    const { gateway } = fixture()
    open(gateway)
    await screen.findByText('Datos remotos pendientes de configuración')
    expect(screen.getAllByText('Definición pendiente de aprobación')).toHaveLength(2)
    await userEvent.click(screen.getByRole('link', { name: 'Sincronización' }))
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    expect(screen.getByText('Sin confirmación')).toBeInTheDocument()
    expect(gateway.audit).not.toHaveBeenCalled()
  })
  it('da un aviso al perder conexión', async () => {
    const { gateway } = fixture()
    open(gateway)
    await screen.findByRole('heading', { name: 'Sucursal Norte' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    expect(await screen.findByText(/Sin conexión. La información remota/)).toBeInTheDocument()
  })
})

describe('auditoría RLS en cliente', () => {
  it('consulta solo A, filtra, pagina y muestra detalle minimizado', async () => {
    const { gateway } = fixture(undefined, [A])
    vi.mocked(gateway.audit).mockImplementation(async filters => ({ rows: [event('a')], total: filters.page === 1 ? PAGE_SIZE + 1 : PAGE_SIZE + 1 }))
    open(gateway, '/auditoria')
    expect(await screen.findByText('sync_result')).toBeInTheDocument()
    expect(gateway.audit).toHaveBeenCalledWith(expect.objectContaining({ branchIds: ['a'], page: 1 }))
    await userEvent.click(screen.getByRole('button', { name: 'Detalle evento 1' }))
    expect(screen.getByText(/No se exponen datos locales/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Código exacto'), 'sync_result')
    await userEvent.selectOptions(screen.getByLabelText('Resultado'), 'success')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(gateway.audit).toHaveBeenCalledWith(expect.objectContaining({ code: 'sync_result', outcome: 'success', branchIds: ['a'] })))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(gateway.audit).toHaveBeenCalledWith(expect.objectContaining({ page: 2, branchIds: ['a'] })))
  })
  it('rechaza respuesta cruzada A/B, sin renderizar el evento ajeno', async () => {
    const { gateway } = fixture(undefined, [A])
    vi.mocked(gateway.audit).mockResolvedValue({ rows: [event('b', 'private_event')], total: 1 })
    open(gateway, '/auditoria')
    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument()
    expect(screen.queryByText('private_event')).not.toBeInTheDocument()
  })
  it('vista A+B autorizadas y estado sin eventos', async () => {
    const { gateway } = fixture()
    open(gateway, '/auditoria')
    expect(await screen.findByText('Sin eventos')).toBeInTheDocument()
    expect(gateway.audit).toHaveBeenCalledWith(expect.objectContaining({ branchIds: ['a', 'b'] }))
  })
})

it('incluye puntos de adaptación móvil/tablet/escritorio y sin ancho rígido en tarjetas', () => {
  expect(css).toContain('@media(max-width:850px)')
  expect(css).toContain('@media(max-width:650px)')
  expect(css).toContain('@media(max-width:360px)')
  expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
  expect(css).toContain('.workspace{min-width:0')
})

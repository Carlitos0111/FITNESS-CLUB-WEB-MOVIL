import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, Building2, ChevronDown, Clock3, CloudOff, LayoutDashboard, ListFilter, LockKeyhole, LogOut, Menu, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { PAGE_SIZE } from './lib/supabase'
import { AccessError, type AuditFilters, type AuditPage, type Branch, type Gateway, type User } from './lib/types'
import { RefreshStatusView } from './components/RefreshStatus'
import './style.css'

type AuthState = { kind: 'loading' | 'guest' | 'ready' | 'error'; user: User | null }
type BranchState = { kind: 'loading' | 'ready' | 'error' | 'denied'; items: Branch[] }
type Context = { gateway: Gateway; user: User; branches: Branch[]; selection: string; select: (id: string) => void; signOut: () => Promise<void> }
const AppContext = createContext<Context | null>(null)
function useApp() { const value = useContext(AppContext); if (!value) throw new Error('Falta contexto'); return value }
function problem(error: unknown) { return navigator.onLine === false ? 'Sin conexión. Revisá tu red y volvé a intentar.' : error instanceof AccessError ? error.message : 'No pudimos cargar la información. Volvé a intentar.' }

function Message({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="message" role="status"><span className="message__icon">{icon}</span><h2>{title}</h2><p>{children}</p>{action}</div>
}

export function App({ gateway }: { gateway: Gateway | null }) {
  if (!gateway) return <div className="center-page"><Message icon={<LockKeyhole />} title="Configuración pendiente">Configurá un proyecto Supabase aislado y autorizado para habilitar el acceso. No se estableció ninguna conexión.</Message></div>
  return <BrowserRouter><Application gateway={gateway} /></BrowserRouter>
}

function Application({ gateway }: { gateway: Gateway }) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading', user: null })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    let version = 0
    const verify = () => {
      const current = ++version
      // Never keep private screens interactive while an existing session is being revalidated.
      setAuth({ kind: 'loading', user: null })
      gateway.getUser().then(user => {
        if (active && current === version) setAuth({ kind: user ? 'ready' : 'guest', user })
      }).catch(() => {
        if (active && current === version) setAuth({ kind: 'error', user: null })
      })
    }
    verify()
    // Supabase emits INITIAL_SESSION synchronously. Defer network verification outside its callback.
    const unsubscribe = gateway.onAuthChange(() => { window.setTimeout(verify, 0) })
    const onFocus = () => verify()
    const onOnline = () => verify()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => { active = false; version++; unsubscribe(); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onOnline) }
  }, [gateway, retry])

  if (auth.kind === 'loading') return <div className="center-page"><Message icon={<RefreshCw />} title="Verificando sesión">Conectando de forma segura…</Message></div>
  if (auth.kind === 'error') return <div className="center-page"><Message icon={<CloudOff />} title="No se pudo verificar la sesión">Sin conexión o servicio no disponible. No se mostrará información privada.<button className="button button--dark" onClick={() => setRetry(value => value + 1)}>Reintentar</button></Message></div>
  return <Routes>
    <Route path="/login" element={auth.user ? <Navigate to="/" replace /> : <Login gateway={gateway} />} />
    <Route path="/*" element={auth.user ? <PrivateArea key={auth.user.id} user={auth.user} gateway={gateway} onLogout={() => setAuth({ kind: 'guest', user: null })} /> : <Navigate to="/login" replace />} />
  </Routes>
}

function Login({ gateway }: { gateway: Gateway }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try { await gateway.signIn(email.trim(), password) }
    catch { setError(navigator.onLine ? 'No se pudo iniciar sesión. Verificá las credenciales y el acceso.' : 'Sin conexión. Reintentá cuando vuelva la red.') }
    finally { setLoading(false) }
  }
  return <div className="login-page"><div className="login-art"><div className="brand brand--light"><span className="brand__mark">F<span>·</span></span><span>FITNESS CLUB<small>PORTAL DE SUCURSALES</small></span></div><div className="login-art__copy"><span className="eyebrow eyebrow--light">TU OPERACIÓN, EN PERSPECTIVA</span><h1>Una mirada clara.<br /><em>Desde cualquier lugar.</em></h1><p>Información autorizada de tus sucursales, en un espacio pensado para decidir con confianza.</p></div><div className="login-art__bottom">ACCESO PRIVADO <span>✳</span> CONSULTA SEGURA</div></div><main className="login-form-wrap"><div className="login-card"><div className="mobile-logo brand"><span className="brand__mark">F<span>·</span></span><span>FITNESS CLUB<small>PORTAL DE SUCURSALES</small></span></div><span className="eyebrow">BIENVENIDO DE NUEVO</span><h2>Ingresá a tu espacio</h2><p className="muted">Accedé con tu cuenta autorizada de Supabase.</p><form onSubmit={submit}><label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@ejemplo.com" required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Ingresá tu contraseña" required /></label>{error && <p className="alert" role="alert">{error}</p>}<button className="button button--primary button--wide" type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Iniciar sesión'} <ArrowRight size={18} /></button></form><div className="login-card__foot"><ShieldCheck size={17} /> Solo usuarios con sucursales asignadas pueden ingresar.</div></div></main></div>
}

function PrivateArea({ gateway, user, onLogout }: { gateway: Gateway; user: User; onLogout: () => void }) {
  const [state, setState] = useState<BranchState>({ kind: 'loading', items: [] })
  const [reload, setReload] = useState(0)
  const [selection, setSelection] = useState('all')
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => {
    let active = true
    setState({ kind: 'loading', items: [] })
    gateway.branches(user.id).then(items => {
      if (active) { setState({ kind: items.length ? 'ready' : 'denied', items }); setSelection(previous => previous === 'all' || items.some(item => item.id === previous) ? previous : 'all') }
    }).catch(error => { if (active) setState({ kind: error instanceof AccessError ? 'denied' : 'error', items: [] }) })
    return () => { active = false }
  }, [gateway, user.id, reload])
  useEffect(() => {
    const recheck = () => setReload(value => value + 1)
    window.addEventListener('focus', recheck)
    window.addEventListener('online', recheck)
    return () => { window.removeEventListener('focus', recheck); window.removeEventListener('online', recheck) }
  }, [])
  async function logout() {
    setLogoutError(''); setLoggingOut(true)
    // Hide private data while sign-out is pending; do not claim it succeeded on failure.
    try { await gateway.signOut(); onLogout() }
    catch { setLogoutError('No se pudo cerrar la sesión. Reintentá; no dejes abierto el navegador en equipos compartidos.') }
    finally { setLoggingOut(false) }
  }
  if (loggingOut) return <div className="center-page"><Message icon={<LogOut />} title="Cerrando sesión">Esperá un momento…</Message></div>
  if (logoutError) return <div className="center-page"><Message icon={<LockKeyhole />} title="No se pudo cerrar sesión">{logoutError}<button className="button button--dark" onClick={logout}>Reintentar cierre</button></Message></div>
  if (state.kind === 'loading') return <div className="center-page"><Message icon={<RefreshCw />} title="Verificando permisos">Consultando tus sucursales asignadas…</Message></div>
  if (state.kind === 'error') return <div className="center-page"><Message icon={<CloudOff />} title="Sucursales no disponibles">{problem(null)}<button className="button button--dark" onClick={() => setReload(value => value + 1)}>Reintentar</button></Message></div>
  if (state.kind === 'denied') return <div className="center-page"><Message icon={<LockKeyhole />} title="Acceso no autorizado">Tu cuenta no tiene sucursales asignadas o no se pudieron verificar tus permisos. Contactá a un administrador.<button className="button button--dark" onClick={logout}>Cerrar sesión</button></Message></div>
  return <AppContext.Provider value={{ gateway, user, branches: state.items, selection, select: id => { if (id === 'all' || state.items.some(item => item.id === id)) setSelection(id) }, signOut: logout }}><Shell /></AppContext.Provider>
}

function Shell() {
  const { user, branches, selection, select, signOut } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const location = useLocation()
  useEffect(() => { setMenuOpen(false) }, [location.pathname])
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) } }, [])
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}><div className="sidebar__top"><div className="brand brand--light"><span className="brand__mark">F<span>·</span></span><span>FITNESS CLUB<small>PORTAL DE SUCURSALES</small></span></div><button className="icon-button sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div><div className="sidebar__caption">ESPACIO DE CONSULTA</div><nav aria-label="Principal"><NavLink end to="/" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}><LayoutDashboard size={19} /> Resumen</NavLink><NavLink to="/auditoria" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}><ListFilter size={19} /> Auditoría</NavLink><NavLink to="/sincronizacion" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}><Activity size={19} /> Sincronización</NavLink></nav><div className="sidebar__bottom"><span className="sidebar__hint">ACCESO PROTEGIDO</span><div className="sidebar__account"><span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span><span className="truncate">{user.email}<small>Cuenta autorizada</small></span></div><button className="nav-link nav-link--logout" onClick={signOut}><LogOut size={18} /> Cerrar sesión</button></div></aside>{menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}<div className="workspace"><header className="topbar"><div className="topbar__left"><button className="icon-button menu-toggle" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu size={23} /></button><span className="topbar__label">PANEL DE CONSULTA <span className="topbar__slash">/</span> FITNESS CLUB</span></div><div className="topbar__right"><span className="secure-tag"><ShieldCheck size={15} /> Acceso seguro</span><label className="branch-picker"><Building2 size={18} /><span className="sr-only">Seleccionar sucursal</span><select aria-label="Seleccionar sucursal" value={selection} onChange={event => select(event.target.value)}><option value="all">Todas las sucursales</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><ChevronDown size={15} /></label></div></header><main className="content">{!online && <p className="alert" role="status">Sin conexión. La información remota puede no estar disponible.</p>}<Routes><Route index element={<Dashboard />} /><Route path="auditoria" element={<Audit />} /><Route path="sincronizacion" element={<Sync />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></main><footer className="footer">FITNESS CLUB <span>·</span> CONSULTA POR SUCURSAL <span>·</span> Sin datos personales</footer></div></div>
}

function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Dashboard() {
  const { branches, selection, select } = useApp()
  const visible = selection === 'all' ? branches : branches.filter(branch => branch.id === selection)
  return <><Heading eyebrow="VISTA GENERAL / 01" title={selection === 'all' ? 'Tus sucursales, de un vistazo.' : visible[0]?.name ?? 'Sucursal'} description="Un espacio de consulta para seguir la actividad autorizada de tu operación." action={<span className="outline-pill"><Building2 size={16} /> {selection === 'all' ? `${branches.length} ${branches.length === 1 ? 'sucursal autorizada' : 'sucursales autorizadas'}` : 'Vista de sucursal'}</span>} /><div className="notice"><span className="notice__icon"><Clock3 size={21} /></span><div><strong>Datos remotos pendientes de configuración</strong><p>Las métricas y la sincronización aún requieren contratos aprobados y un backend autorizado. No se muestran cifras ni fechas sin confirmación.</p></div></div><div className="section-title"><div><span className="eyebrow">PANORAMA</span><h2>Indicadores de gestión</h2></div><span className="section-title__note">SIN DATOS CONFIRMADOS</span></div><div className="metric-grid">{['Actividad de sucursales', 'Indicadores agregados', 'Última actualización'].map((label, index) => <article className="metric-card" key={label}><span className="metric-card__icon">{index === 2 ? <RefreshCw size={20} /> : index === 1 ? <Activity size={20} /> : <Building2 size={20} />}</span><h3>{label}</h3><div className="metric-card__value">—</div><p>{index === 2 ? 'Sin confirmación del backend' : 'Definición pendiente de aprobación'}</p></article>)}</div><div className="section-title section-title--second"><div><span className="eyebrow">ACCESOS</span><h2>Sucursales autorizadas</h2></div><span className="section-title__note">{visible.length} EN ESTA VISTA</span></div><div className="branch-grid">{visible.map((branch, index) => <article className="branch-card" key={branch.id}><div className="branch-card__head"><span className="branch-card__icon"><Building2 size={23} /></span><span className="branch-card__number">{String(index + 1).padStart(2, '0')}</span></div><h3>{branch.name}</h3><p>Zona horaria: {branch.timeZone}</p><span className="branch-card__status"><span className="dot" /> Asignación verificada</span><div className="branch-card__actions"><button className="text-action" onClick={() => select(branch.id)}>Ver sucursal <ArrowRight size={16} /></button><Link to="/auditoria" className="text-action">Ver auditoría <ArrowRight size={16} /></Link></div></article>)}</div>{selection !== 'all' && <button className="back-link" onClick={() => select('all')}><ArrowLeft size={16} /> Ver todas las sucursales</button>}</>
}

function Sync() {
  const { branches, selection } = useApp()
  return <><Heading eyebrow="ESTADO / 03" title="Sincronización" description="Estado de la integración remota para las sucursales de tu cuenta." /><div className="sync-layout"><div className="panel sync-feature"><span className="feature-icon"><RefreshCw size={27} /></span><span className="eyebrow">INTEGRACIÓN REMOTA</span><h2>Esperando configuración</h2><p>No hay un backend autorizado para solicitar ni confirmar actualizaciones. La sincronización del Desktop permanece desactivada.</p><button className="button button--primary" disabled title="Requiere backend autorizado"><RefreshCw size={17} /> Actualizar</button><small>Requiere configuración de un backend seguro. No se envía ningún comando al Desktop.</small></div><div className="sync-side"><div className="panel detail-panel"><span className="eyebrow">ESTADO ACTUAL</span><h3>Sucursal seleccionada</h3><p>{selection === 'all' ? 'Todas las sucursales autorizadas' : branches.find(branch => branch.id === selection)?.name}</p><RefreshStatusView status={{ phase: 'unconfigured' }} /><div className="detail-row"><span>Instalación autorizada</span><strong>Pendiente de verificar en servidor</strong></div></div><div className="panel detail-panel"><span className="eyebrow">PRÓXIMOS PASOS</span><h3>Conexión responsable</h3><p>El futuro backend deberá autenticar la solicitud, verificar sucursal e instalación, deduplicar operaciones y confirmar su resultado antes de mostrar una actualización.</p></div></div></div></>
}

const emptyFilters = (): AuditFilters => ({ branchIds: [], code: '', outcome: '', from: '', to: '', page: 1 })
function Audit() {
  const { gateway, branches, selection } = useApp()
  const allowed = selection === 'all' ? branches.map(branch => branch.id) : branches.filter(branch => branch.id === selection).map(branch => branch.id)
  const [draft, setDraft] = useState({ code: '', outcome: '' as AuditFilters['outcome'], from: '', to: '' })
  const [applied, setApplied] = useState(emptyFilters())
  const [result, setResult] = useState<AuditPage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading')
  const [refresh, setRefresh] = useState(0)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [validation, setValidation] = useState('')
  const ids = allowed.join(',')
  useEffect(() => { setApplied(emptyFilters()); setDraft({ code: '', outcome: '', from: '', to: '' }); setExpanded(null) }, [selection])
  useEffect(() => {
    let active = true
    setStatus('loading'); setResult(null); setExpanded(null)
    const requested = ids ? ids.split(',') : []
    gateway.audit({ ...applied, branchIds: requested }).then(page => {
      if (!active) return
      if (page.rows.some(row => !requested.includes(row.branchId))) throw new AccessError('La respuesta incluye una sucursal no autorizada.')
      setResult(page); setStatus('ready')
    })
      .catch(error => { if (active) setStatus(error instanceof AccessError ? 'denied' : 'error') })
    return () => { active = false }
  }, [gateway, ids, applied, refresh])
  function filter(event: FormEvent) {
    event.preventDefault()
    if (draft.code && !/^[a-z][a-z0-9_]{0,63}$/.test(draft.code)) { setValidation('El código debe usar letras minúsculas, números o guiones bajos.'); return }
    if (draft.from && draft.to && draft.from > draft.to) { setValidation('La fecha inicial no puede ser posterior a la final.'); return }
    setValidation(''); setApplied({ ...draft, branchIds: [], page: 1 })
  }
  const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE))
  return <><Heading eyebrow="HISTORIAL / 02" title="Auditoría" description="Eventos minimizados de las sucursales a las que tenés acceso." action={<button className="button button--outline" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /> Recargar</button>} /><form className="filters panel" onSubmit={filter}><div className="filters__title"><ListFilter size={19} /><strong>Filtrar eventos</strong></div><div className="filters__grid"><label>Código de evento<input value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} placeholder="Código exacto" maxLength={64} /></label><label>Resultado<select value={draft.outcome} onChange={event => setDraft({ ...draft, outcome: event.target.value as AuditFilters['outcome'] })}><option value="">Todos</option><option value="success">Correcto</option><option value="failure">Fallido</option></select></label><label>Desde<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>Hasta<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label><button className="button button--dark" type="submit">Aplicar filtros</button></div>{validation && <p role="alert" className="alert">{validation}</p>}</form><div className="section-title section-title--second"><div><span className="eyebrow">REGISTROS</span><h2>Historial autorizado</h2></div>{status === 'ready' && <span className="section-title__note">{result?.total ?? 0} EVENTOS</span>}</div><div className="panel audit-panel">{status === 'loading' && <Message icon={<RefreshCw />} title="Cargando historial">Consultando eventos autorizados…</Message>}{status === 'denied' && <Message icon={<LockKeyhole />} title="Acceso denegado">No se pudo consultar este historial. Revisá los permisos con un administrador.</Message>}{status === 'error' && <Message icon={<CloudOff />} title="Historial no disponible">{problem(null)}<button className="button button--dark" onClick={() => setRefresh(value => value + 1)}>Reintentar</button></Message>}{status === 'ready' && result && (result.rows.length === 0 ? <Message icon={<ListFilter />} title="Sin eventos">No hay eventos para esta selección y filtros. Puede que todavía no se haya configurado la ingestión.</Message> : <><div className="audit-list">{result.rows.map((event, index) => <article className="audit-row" key={`${event.branchId}-${event.occurredAt}-${event.code}-${index}`}><div className="audit-row__icon"><Activity size={18} /></div><div className="audit-row__main"><strong>{event.code}</strong><span>{branches.find(branch => branch.id === event.branchId)?.name ?? 'Sucursal autorizada'} <span className="separator">·</span> {new Date(event.occurredAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}</span>{expanded === index && <div className="audit-detail">Detalle permitido: código {event.code}, resultado {event.outcome === 'success' ? 'correcto' : 'fallido'}, contrato v{event.contractVersion}. No se exponen datos locales ni identificadores de origen.</div>}</div><span className={`result-tag result-tag--${event.outcome}`}>{event.outcome === 'success' ? 'Correcto' : 'Fallido'}</span><button className="icon-button" aria-label={`Detalle evento ${index + 1}`} aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}><ChevronDown size={18} /></button></article>)}</div><div className="pagination"><span>Página {applied.page} de {totalPages}</span><div><button className="button button--outline" disabled={applied.page <= 1} onClick={() => setApplied({ ...applied, page: applied.page - 1 })}>Anterior</button><button className="button button--outline" disabled={applied.page >= totalPages} onClick={() => setApplied({ ...applied, page: applied.page + 1 })}>Siguiente</button></div></div></>)}</div></>
}

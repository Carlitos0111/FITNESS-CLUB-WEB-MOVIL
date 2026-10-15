// Future backend contract only. Production always passes `unconfigured` until approved.
export type RefreshStatus =
  | { phase: 'unconfigured' }
  | { phase: 'pending' | 'updating' | 'error'; lastConfirmedAt: string | null }
  | { phase: 'completed'; lastConfirmedAt: string }

const labels = { unconfigured: 'No disponible', pending: 'Pendiente', updating: 'Actualizando', completed: 'Completado', error: 'Error' }

export function RefreshStatusView({ status }: { status: RefreshStatus }) {
  return <>
    <div className="detail-row"><span>Solicitud</span><strong className={status.phase === 'unconfigured' ? 'pending' : ''}>{labels[status.phase]}</strong></div>
    <div className="detail-row"><span>Última actualización confirmada</span><strong>{'lastConfirmedAt' in status && status.lastConfirmedAt ? new Date(status.lastConfirmedAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin confirmación'}</strong></div>
  </>
}

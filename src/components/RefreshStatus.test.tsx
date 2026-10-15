import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { RefreshStatusView, type RefreshStatus } from './RefreshStatus'

afterEach(cleanup)
it.each<RefreshStatus>([
  { phase: 'unconfigured' },
  { phase: 'pending', lastConfirmedAt: null },
  { phase: 'updating', lastConfirmedAt: null },
  { phase: 'completed', lastConfirmedAt: '2026-10-14T12:00:00Z' },
  { phase: 'error', lastConfirmedAt: null },
])('representa el estado $phase sin inventar confirmaciones', status => {
  render(<RefreshStatusView status={status} />)
  expect(screen.getByText('Última actualización confirmada')).toBeInTheDocument()
  if (status.phase !== 'completed') expect(screen.getByText('Sin confirmación')).toBeInTheDocument()
  else expect(screen.queryByText('Sin confirmación')).not.toBeInTheDocument()
})

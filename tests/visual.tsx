// Only served by the development test fixture; not included in the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../src/App'
import type { Gateway } from '../src/lib/types'

const gateway: Gateway = {
  async getUser() { return { id: 'fixture', email: 'PRUEBA@ejemplo.test' } },
  onAuthChange() { return () => {} },
  async signIn() {}, async signOut() {},
  async branches() { return [
    { id: 'a', name: 'Sucursal Norte · DATOS FICTICIOS', timeZone: 'America/Argentina/Buenos_Aires' },
    { id: 'b', name: 'Sucursal Sur · DATOS FICTICIOS', timeZone: 'America/Argentina/Buenos_Aires' },
  ] },
  async audit() { return { rows: [{ branchId: 'a', code: 'evento_prueba', outcome: 'success', occurredAt: '2026-10-14T12:00:00Z', contractVersion: 1 }], total: 1 } },
}
createRoot(document.getElementById('root')!).render(<App gateway={gateway} />)

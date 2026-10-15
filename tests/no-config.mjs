import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { preview } from 'vite'

assert.ok(!readdirSync('.').some(name => name.startsWith('.env') && name !== '.env.example'), 'No ejecutar esta prueba con archivos .env locales: podría usar una configuración real.')
assert.ok(!process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_ANON_KEY, 'No ejecutar esta prueba con variables VITE_SUPABASE_* definidas.')

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  const origin = new URL(server.resolvedUrls.local[0]).origin
  browser = await chromium.launch({ executablePath: process.env.FC09_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage()
  const remote = []
  const errors = []
  await page.route('**/*', route => {
    const requested = new URL(route.request().url())
    if (requested.origin !== origin) { remote.push(requested.origin); return route.abort() }
    return route.continue()
  })
  page.on('pageerror', error => errors.push(error.message))
  for (const path of ['/', '/auditoria', '/sincronizacion']) {
    const response = await page.goto(`${origin}${path}`)
    assert.equal(response.status(), 200, path)
    await page.getByRole('heading', { name: 'Configuración pendiente' }).waitFor()
  }
  assert.deepEqual(remote, [], 'No debe intentar conexiones fuera del localhost')
  assert.deepEqual(errors, [], 'No debe haber errores JS')
  console.log('PASS build sin configuración: estado pendiente, 3 rutas, sin errores JS ni solicitudes remotas')
} finally {
  await browser?.close()
  await server.httpServer.close()
}

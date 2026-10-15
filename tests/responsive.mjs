import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const browserPath = process.env.FC09_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } })
let browser
try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({ executablePath: browserPath, headless: true })
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, deviceScaleFactor: 1 })
    for (const route of ['/', '/auditoria', '/sincronizacion']) {
      await page.goto(`http://127.0.0.1:${address.port}/tests/visual.html`)
      await page.getByText('Sucursal Norte · DATOS FICTICIOS').last().waitFor()
      if (route !== '/') {
        if (width <= 850) await page.getByRole('button', { name: 'Abrir menú' }).click()
        await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: route === '/auditoria' ? 'Auditoría' : 'Sincronización', exact: true }).click()
      }
      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        cards: [...document.querySelectorAll('.metric-card,.branch-card,.filters,.audit-panel,.sync-feature')].map(element => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, width: rect.width }
        }),
      }))
      assert.ok(geometry.document <= geometry.viewport + 1, `${width}px ${route}: overflow ${JSON.stringify(geometry)}`)
      for (const card of geometry.cards) assert.ok(card.left >= -1 && card.right <= width + 1 && card.width > 0, `${width}px ${route}: tarjeta desbordada ${JSON.stringify(card)}`)
    }
    await page.close()
    console.log(`PASS responsive ${width}px: resumen, auditoría, sincronización`)
  }
} finally {
  await browser?.close()
  await server.close()
}

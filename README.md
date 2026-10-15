# Fitness Club · Web móvil (FC-09)

Aplicación **independiente** del Desktop para consultas por sucursal. No hay despliegue ni conexión a producción configurada. FC-07 todavía no fue aplicada a Supabase y FC-08 sigue sin emisor remoto; una pantalla vacía **no** demuestra que exista sincronización.

## Iniciar en Windows

Requisitos: Node.js 22.12+ (o 24+) y npm. Desde PowerShell:

```powershell
cd C:\Users\carlo\Desktop\FITNESS-CLUB-WEB-MOVIL
npm ci
npm run dev
```

**URL local:** http://127.0.0.1:5173/ . Sin `.env`, se muestra “Configuración pendiente” y no se conecta a Supabase. Para probar login real, copiar `.env.example` a `.env.local` y completar exclusivamente valores públicos de un **proyecto aislado autorizado**, siguiendo [docs/SUPABASE.md](docs/SUPABASE.md). Nunca usar credenciales de clientes para demos. En un teléfono físico `127.0.0.1` apunta al propio teléfono: el equipo deberá autorizar un servidor HTTPS de prueba y configurar el entorno; no abrir `--host 0.0.0.0` sin control de red.

```powershell
npm run typecheck
npm test
npm run test:responsive
npm run build
npm run test:no-config
```

El build estático queda en `dist/`. `test:no-config` examina el **build generado sin variables** en Chrome; bloquea solicitudes externas y se niega a ejecutarse si encuentra `.env` local. No se necesita .NET, Desktop ni instalador para ejecutarla.

## Pantallas

- Login con Supabase Auth (email/contraseña existente), verificación de usuario mediante `getUser`, revalidación en eventos de Auth, al recuperar foco o conectividad, y cierre de sesión. El cliente oculta el área privada mientras verifica identidad y asignaciones.
- Resumen con selector de sucursal y “Todas”; tarjetas de sucursales asignadas. Indicadores/última actualización muestran **pendiente**, nunca importes ni cifras supuestas.
- Auditoría minimizada por sucursal, filtros de código exacto, resultado y rango de fechas locales del navegador, 12 registros por página, detalle acotado. No consulta `audit_logs`, instalaciones ni identificadores de origen.
- Sincronización: estado explícito **no disponible**; “Actualizar” está deshabilitado. Ver [docs/CONTRATOS-PENDIENTES.md](docs/CONTRATOS-PENDIENTES.md).

Responsive con navegación lateral en escritorio y menú móvil, layouts fluidos en tablet/celular; `test:responsive` verifica geometría headless con Chrome instalado en `C:\Program Files\Google\Chrome\Application\chrome.exe` (o variable `FC09_BROWSER_PATH`) y datos ficticios de `tests/visual.html`, **solo en Vite dev, excluido del build**. Faltan pruebas visuales en dispositivos reales ([docs/PRUEBAS-EXTERNAS.md](docs/PRUEBAS-EXTERNAS.md)). Las pruebas automatizadas usan solo dobles ficticios, sin llamar a Supabase.

## Estructura

`src/App.tsx`: navegación, seguridad visual, pantallas. `src/lib/supabase.ts`: consultas de columnas permitidas FC-07 y Auth. `src/lib/types.ts`: contratos del cliente. `src/style.css`: diseño responsive. `src/App.test.tsx`: pruebas con dobles. `docs/`: guías de configuración, Pages, contratos y aceptación.

**Dependencias de runtime:** React, React DOM, React Router, Supabase JS y Lucide React. **Herramientas:** TypeScript, Vite, Vitest, Testing Library, jsdom, plugin React y Playwright para geometría headless. Versiones exactas fijadas en `package-lock.json`; `npm ci` reproduce el árbol. La tipografía usa fuentes disponibles en el sistema (sin CDN). La app no incluye usuarios, snapshots falsos, biometría ni secretos.

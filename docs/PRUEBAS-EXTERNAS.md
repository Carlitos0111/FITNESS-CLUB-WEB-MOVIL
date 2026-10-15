# Checklist de validación externa (otro integrante)

**No realizado aquí:** conexiones reales, migración/despliegue de Supabase, pruebas en dispositivos físicos o Cloudflare. Usar únicamente instancia aislada autorizada con datos ficticios; no compartir URL, tokens ni capturas de datos reales. Seguir primero `tests/FC07/README.md` del Desktop para el SQL aislado, sin tocar el Desktop.

- [ ] Verificar destino, esquema, grants y RLS FC-07 bajo JWT reales de Supabase Auth (no solo `SET ROLE` SQL); no usar producción.
- [ ] Usuarios A, B, A+B y sin asignación: login y rutas directas, 401/403, selector, resultados de auditoría y ausencia de columnas ocultas; revocar mientras hay sesión y repetir.
- [ ] Sesión expirada/revocada, recarga, múltiples pestañas, foco, logout con/sin red: no exponer datos luego de perder autorización.
- [ ] Auditoría: filtros de código/resultado/fechas, rango en cambio horario, página vacía, múltiples páginas y coincidencias con timestamp igual; verificar no hay datos personales ni `origin_installation_id`.
- [ ] Confirmar que métricas/última sincronización siguen sin cifras y “Actualizar” no envía nada; sin backend no declarar éxito.
- [ ] Sin `.env` o URL inválida: pantalla de configuración pendiente y **cero** llamadas remotas; con FC-07 sin desplegar: error explícito, no desbloquear RLS.
- [ ] Revisar con herramientas de navegador ancho `320`, `360`, `390`, `768`, `1024`, `1440` px y zoom 200%; menú, selector, tarjetas, filtros, paginación, teclado y ausencia de scroll horizontal/solapes.
- [ ] Verificar teclado/foco/lectores de pantalla, contraste, orientaciones móvil/tablet, desconexión/reconexión.
- [ ] Antes de publicar en Pages: HTTPS, Auth URL permitida, dominio preview, CSP/caché y validación de datos permitidos.

Registrar ambiente, versión/commit futuro de web si corresponde, navegador, resultados y evidencia **sin secretos**. Reportar fallas al equipo sin modificar datos reales.

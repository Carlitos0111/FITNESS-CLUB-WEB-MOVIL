# Dependencias y decisiones abiertas FC-09

## Métricas

FC-07 define `branch_metric_snapshots` con `branch_id`, instalación/operación **no legibles por cliente**, `metric_code`, `definition_version`, `[period_start,period_end)`, `metric_value`, `updated_at`. No hay catálogo aprobado de códigos, fórmulas, unidades, períodos ni husos. **No se consultan ni muestran valores** hasta aprobarlos. La UI tiene tarjetas “pendiente”. No sumar snapshots: la clave única por sucursal/código/versión/período no establece aditividad entre capturas, ni cómo tratar varias instalaciones, períodos solapados, revisiones o frescura. Se necesita un contrato de proyección consolidada en backend (deduplicación por operación, reglas para múltiples instalaciones y rangos, versión/fecha de confirmación), tests y política de retención antes de activar cifras.

## Auditoría

FC-07 concede solo `event_code`, `outcome`, `occurred_at`, `contract_version` y `branch_id` de `branch_audit_events`. La web consulta estos campos; el detalle repite solo estos datos. Falta catálogo de eventos aprobado y políticas de retención. Paginación `range()` con orden descendente por fecha y desempate por sucursal/código; en timestamps/códigos idénticos o ante inserciones simultáneas el orden offset no garantiza estabilidad absoluta. Para historial inmutable estable se necesita un cursor público no sensible y contrato de paginación aprobado en backend/RLS. Fechas de filtro: día del dispositivo local, rango inclusivo al usuario / exclusivo en UTC en la consulta; acordar si deben convertirse según `branches.time_zone` antes de extender la función.

## Actualizar (solo contrato propuesto; **no hay endpoint**)

El botón permanece deshabilitado y no genera solicitudes. El componente `RefreshStatusView` acepta `unconfigured | pending | updating | completed | error`, pero en producción **solo recibe `unconfigured`**; los otros estados se prueban con datos ficticios. Un futuro backend de Impulso Digital deberá ofrecer, previa aprobación, una operación autenticada por JWT de usuario (p. ej. `POST /branch-refresh-requests`), con `{ branchId, installationId, idempotencyKey }` en el cuerpo, nunca claves privilegiadas del browser. Primero valida `auth.uid()` y asignación vigente; verifica instalación existente y asociación autorizada a la sucursal, estado/revocación del agente y permiso de acción **nuevo** si se aprueba. La instalación no está disponible para lectura por navegador en FC-07: el backend debe resolver/ofrecer únicamente las instalaciones autorizadas, sin exponer el canal del ID de instalación existente. En vista “Todas” no hay solicitud masiva implícita: exigir sucursal concreta y, si hay varias instalaciones, elección aprobada y validada por servidor.

Deduplicar transaccionalmente `(instalación, idempotencyKey)` y evitar trabajos concurrentes incompatibles; responder con identificador opaco de solicitud, estado `pending | updating | completed | error`, fecha de aceptación, fecha de **última actualización confirmada** por recibo verificado y código de error sanitizado. Exponer un GET/poll autenticado con RLS o validación equivalente. `completed` exige recibo real del agente y vínculo con el ciclo de sincronización; un HTTP 202, un `updated_at` de snapshot o un timeout NO equivalen a éxito. FC-08 hoy no tiene gateway operativo ni endpoint; debe acordarse contrato, timeout/reintentos, revocación, observabilidad y permiso antes de implementar la llamada. Nunca mandar comandos desde la web al Desktop.

## Operación

- Reutilizar Supabase de Impulso Digital **solo después de aprobación** y validar FC-07 contra el estado remoto real. No desplegada actualmente.
- Provisión/revocación de usuarios/asignaciones, RLS con JWT y endurecimiento CORS/Auth.
- Definir catálogo de métricas y eventos, origen confiable, aprobación de datos, retención y cuotas.
- Construir backend de ingestión/agentes de FC-08 y backend de actualización; Desktop sigue local-first e inactivo remoto.
- Probar UI visual real y accesibilidad en dispositivos; la prueba geométrica headless de Chrome no sustituye pruebas físicas.

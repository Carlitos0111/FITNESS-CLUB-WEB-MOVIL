# Dependencias y decisiones abiertas FC-09

## Métricas

FC-07 define `branch_metric_snapshots` con `branch_id`, instalación/operación **no legibles por cliente**, `metric_code`, `definition_version`, `[period_start,period_end)`, `metric_value`, `updated_at`. No hay catálogo aprobado de códigos, fórmulas, unidades, períodos ni husos. **No se consultan ni muestran valores** hasta aprobarlos. La UI tiene tarjetas “pendiente”. No sumar snapshots: la clave única por sucursal/código/versión/período no establece aditividad entre capturas, ni cómo tratar varias instalaciones, períodos solapados, revisiones o frescura. Se necesita un contrato de proyección consolidada en backend (deduplicación por operación, reglas para múltiples instalaciones y rangos, versión/fecha de confirmación), tests y política de retención antes de activar cifras.

## Auditoría

FC-07 concede solo `event_code`, `outcome`, `occurred_at`, `contract_version` y `branch_id` de `branch_audit_events`. La web consulta estos campos; el detalle repite solo estos datos. Falta catálogo de eventos aprobado y políticas de retención. Paginación `range()` con orden descendente por fecha y desempate por sucursal/código; en timestamps/códigos idénticos o ante inserciones simultáneas el orden offset no garantiza estabilidad absoluta. Para historial inmutable estable se necesita un cursor público no sensible y contrato de paginación aprobado en backend/RLS. Fechas de filtro: día del dispositivo local, rango inclusivo al usuario / exclusivo en UTC en la consulta; acordar si deben convertirse según `branches.time_zone` antes de extender la función.

## Actualizar (implementación local, **no desplegada**)

En la rama de integración (2026-10-15) existe `branch-bridge` en el repositorio Desktop y migración aditiva separada de agentes, permisos y solicitudes. El navegador usa JWT de Supabase Auth (comprobado con `getUser()` en el servidor); la función valida `branch_users`, `branch_refresh_grants`, instalación activa, agente y activación cloud antes de admitir la solicitud. Web no lee la tabla de instalaciones directamente ni recibe secretos. En vista “Todas” no hay solicitud masiva: se selecciona sucursal e instalación autorizada. La UI permanece deshabilitada sin `VITE_BRANCH_BRIDGE_ENABLED=true` y sin instalaciones concedidas por el servidor. El productor Desktop no tiene catálogo aprobado; el flujo completo sigue **bloqueado**.

El componente `RefreshStatusView` muestra `unconfigured | pending | updating | completed | error` según el backend (sin endpoint: `unconfigured`). `POST refresh` requiere `{branchId,installationId,idempotencyKey}` y deduplica por instalación/clave; solo usuarios con permiso explícito pueden listar instalaciones. Solicitudes simultáneas incompatibles y nuevas antes de un minuto se rechazan. La sesión expirada impide escritura y retira el acceso local.

`completed` requiere el acuse autenticado del agente posterior al ciclo Desktop; un HTTP 202, `updated_at` o timeout nunca son éxito. El estado se consulta con `GET status` para las solicitudes del usuario autenticado. **Pendiente:** revisión de seguridad y retención, política definitiva de permisos y catálogo/productor real de datos minimizados. La web no envía órdenes operativas al Desktop.

## Operación

- Reutilizar Supabase de Impulso Digital **solo después de aprobación** y validar FC-07 contra el estado remoto real. No desplegada actualmente.
- Provisión/revocación de usuarios/asignaciones, RLS con JWT y endurecimiento CORS/Auth.
- Definir catálogo de métricas y eventos, origen confiable, aprobación de datos, retención y cuotas.
- Construir backend de ingestión/agentes de FC-08 y backend de actualización; Desktop sigue local-first e inactivo remoto.
- Probar UI visual real y accesibilidad en dispositivos; la prueba geométrica headless de Chrome no sustituye pruebas físicas.

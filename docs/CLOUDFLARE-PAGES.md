# Cloudflare Pages — guía, no despliegue

1. Obtener aprobación para publicar y un proyecto Supabase **autorizado**; verificar sus políticas FC-07, Auth y la política de exposición de datos. No publicar esta versión contra producción ni asumir que FC-08 sincroniza.
2. Con un repositorio propio aprobado (este trabajo **no** crea ninguno), configurar Pages: framework **Vite**, build command `npm ci && npm run build`, output `dist`, directorio raíz de este proyecto (`.` si el repo contiene solo la web), `NODE_VERSION=22.12.0` o una versión posterior compatible. Variables de build `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` **públicas** únicamente. No utilizar secretos en `VITE_*`, ni pegar contraseñas en Settings/commits.
3. Revisar `public/_redirects` para fallback SPA (`/auditoria`, `/sincronizacion` y rutas privadas). Configurar dominio HTTPS/orígenes permitidos en Supabase Auth; bloquear dominios preview si no son autorizados. Los assets son públicos; solo las consultas requieren sesión y RLS.
4. Evaluar cabeceras de seguridad, CSP (sin CDN de fuentes), política de caché, límites de error y revalidación en móviles antes de producción. Validar permisos A/B y logout en el dominio final.

Ningún comando aquí despliega a Cloudflare automáticamente.

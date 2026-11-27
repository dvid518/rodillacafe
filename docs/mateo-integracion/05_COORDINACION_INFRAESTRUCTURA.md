# Coordinación con Jianpierre

**No se ejecutó ningún comando remoto sobre la infraestructura del proyecto.** Aplicar primero en un proyecto de staging autorizado, con datos sintéticos. Antes de cualquier despliegue a producción, obtener autorización explícita.

## Preparar el entorno

- Rotar o confirmar la revocación de las claves históricas de Factiliza identificadas en `js/config.js` de `e95707d` y `fa5d79a`. No copiar sus valores al repositorio ni al chat; no reescribir el historial como sustituto de la revocación.
- Usar una credencial válida en `FACTILIZA_KEY_1`; `FACTILIZA_KEY_2` y `_3` son opcionales para el orden de selección de configuración, no para rotar ante errores. Verificar facturación y política de reintentos con Factiliza.
- Verificar las variables provistas por Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) y la lista de orígenes `DOCUMENT_LOOKUP_ORIGINS` para staging. No usar `service_role` para consultas de usuario.
- Confirmar que `is_admin()` e `is_rol(p_rol text)` están desplegadas y responden con el JWT del solicitante; comprobar las políticas RLS de `PERSONA`, `EMPRESA` y las relaciones de cliente que usa Ventas. Verificar explícitamente qué filas quedan invisibles para Cajero; una fila oculta por RLS no prueba ausencia global.
- Conservar la validación de sesión y verificar la compatibilidad del gateway de Edge con el método de firma JWT del proyecto. CORS no concede roles ni protege llamadas fuera del navegador.

## Operación de staging (solo Jianpierre, bajo autorización)

Desde la raíz del repo con CLI autenticada y una copia privada del archivo de entorno fuera del repositorio:

```sh
supabase secrets set --project-ref "$STAGING_PROJECT_REF" --env-file "$PRIVATE_ENV_FILE"
supabase functions deploy consultar-dni --project-ref "$STAGING_PROJECT_REF"
supabase functions deploy consultar-ruc --project-ref "$STAGING_PROJECT_REF"
supabase functions list --project-ref "$STAGING_PROJECT_REF"
```

Desplegar desde el árbol completo: los dos entrypoints importan código de `supabase/functions/_shared/`. No activar un proyecto en producción por accidente. Registrar solo el nombre de la función, el código HTTP, la latencia y el ID de correlación saneado; no registrar documento, bearer, cuerpos ni la URL completa de Factiliza. En Vercel, verificar que un Preview no publique `.env*`, `sw.js.bak`, SQL, scripts, grafo ni archivos de Edge.

## Pruebas conjuntas pendientes

1. Admin: DNI en Usuarios y RUC en Empresas. Admin y Cajero: DNI/RUC en Ventas. Confirmar que un acierto en BD no llama a la Edge ni factura al proveedor.
2. Sin sesión, sesión caducada y rol no permitido contra staging: 401/403 sin llamadas a Factiliza. Verificar CORS desde los orígenes autorizados, incluyendo preflight.
3. Solo con permiso para consumir cuota, usar fixtures autorizados por el proveedor: un acierto y una ausencia documentada. Confirmar formato y mapeo sin compartir datos personales.
4. Simular 429, 503, latencia y desconexión con mocks o red del navegador, no derribando infraestructura. Comprobar la recuperación del formulario y que una caída no se reporte como 404.
5. Definir alertas sobre volumen y costo por rol/usuario, tasa de 429 y 5xx, y latencia. La autorización de staff no reemplaza un límite distribuido ni la monitorización de abuso.

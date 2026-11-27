# Auditoría inicial de DNI/RUC

Base observada: `bebb1b9` (`main` limpio). Rama local: `feat/mateo-integracion-cloud`. Node v24.21.0 disponible; Deno y Supabase CLI no detectados en PATH. No se consultó producción.

| Responsabilidad | Estado inicial | Evidencia en la base | Acción |
|---|---|---|---|
| Revisar DNI/RUC | Parcial | `js/services/{dni,ruc}Service.js` consultan `PERSONA`/`EMPRESA`, pero siguen al proveedor si falla PostgREST. RUC se limpia de caracteres no numéricos. | Validar antes de I/O, distinguir error de ausencia y verificar el documento devuelto. |
| Frontend → Edge Functions | Presente en código | `functions.invoke` en ambos servicios; `userService.js` reutiliza DNI; consumidores en `js/views/dashboard/{usuarios,empresas,ventas}.js`. | Confirmar el flujo con mocks y dejar el smoke test para staging. |
| Llamadas directas | No activas en el flujo revisado | `js/config.js:5,7` conserva dos URLs exportadas sin consumidores. `EmpresaAdapter.js:3–19` conserva un ejemplo comentado desactualizado; `sw.js` solo compara el host para no cachear. | Limpiar exportaciones/comentario sin eliminar referencias documentales legítimas. |
| Credenciales | Parcial | Secrets leídos del entorno en ambas Edge; no control de rol en el handler; CORS `*`. Historial `e95707d` y `fa5d79a`: `API_KEYS_DNI` en `js/config.js`, con entradas literales. | Verificar y rotar cualquier clave histórica válida; proteger artefactos y validar sesión/rol en Edge. |
| Errores, tiempo y reintentos | Deficiente | Las Edge recorren todas las claves y devuelven 404 tras fallos; no hay cancelación explícita. Los servicios leen el error genérico del SDK. | Clasificar por origen, acotar tiempo e intentos, no insistir ante cuota o credenciales. |
| Pruebas de integración | Sin suite reproducible para este flujo | `package.json` solo declara módulos ESM; los scripts de cuentas son otra herramienta. | Probar contratos con datos sintéticos en Node, y verificar en staging con infraestructura. |
| Indisponibilidad | Sin evidencia de verificación | Los handlers de UI pueden dejar estado temporal sin restaurar o aplicar resultados obsoletos. | Inyectar fallos y comprobar recuperación sin simular caídas de producción. |

`docs/AUDITORIA_AVANCE3.md` describe un corte anterior con consumo directo; `AUDITORIA_CLOUD_RODILLA.md` y `docs/REPORTE_FINAL_AVANCE3.md` describen el proxy y dejan pendiente su despliegue/secrets. El código de esta base acredita el proxy en el repositorio, no su estado en Supabase. `docs/ARQUITECTURA.md` y el SQL de RLS describen el modelo de roles, no la configuración aplicada en remoto.

## Alcance de seguridad

- `js/config.js` usa una clave pública Supabase `publishable`; se conserva. No equivale a `service_role` ni concede permisos sobre RLS.
- `.vercelignore` ya excluía `supabase/`, `sql/` y `work/`; faltaban los scripts de prueba, el grafo generado, respaldos y variantes de `.env`.
- `sw.js.bak` está versionado en UTF-16; no se detectó una URL completa de consulta ni un JWT/secreto Supabase mediante los patrones probados. El nombre del host en `sw.js` es una regla de red, no una consulta iniciada por el cliente.
- Evidencia sin valores: [auditoría de Git](evidencias/auditoria-git.txt). Es una revisión por patrones y commits localizados, no una certificación de todo el historial ni del despliegue actual.

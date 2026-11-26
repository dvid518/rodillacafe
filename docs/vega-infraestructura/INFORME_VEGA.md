# Informe de entrega — Infraestructura Cloud

**Alumno:** Jianpierre (Vega)
**Proyecto:** Rodilla — Servicios Cloud UTP 2026-II
**Repositorio:** https://github.com/dvid518/rodillacafe
**Proyecto Supabase:** `zmksxwgikagorgyeyhli` (organización Rodilla, plan Free, `us-west-2`)
**Motor:** PostgreSQL 17.6.1.166 — estado `ACTIVE_HEALTHY`
**Fecha:** 21/11/2026
**Herramientas:** Supabase CLI 3.2.0, Management API y SQL Editor

**Documentos de detalle:**
- `EVIDENCIAS_VEGA.md` — verificación punto por punto con consultas y respuestas reales.
- `AUDITORIA_SEGURIDAD_VEGA.md` — hallazgos, severidades, evidencias y remediaciones.

---

## 1. Configuración del proyecto Supabase

| Aspecto | Resultado |
|---|---|
| Organización / plan | Rodilla / Free |
| Región | `us-west-2` |
| Estado | `ACTIVE_HEALTHY` |
| Tamaño de BD | 15 MB (límite Free: 500 MB) |
| Retención de logs | 1 día |
| Backups automáticos | No incluidos en Free |
| Pausa por inactividad | Sí, tras 1 semana |

✅ Configuración revisada. El proyecto está operativo y dentro de los límites del plan.

---

## 2. Secrets de Factiliza

| Secret | Estado |
|---|---|
| `FACTILIZA_KEY_1` | Configurado |
| `FACTILIZA_KEY_2` | Configurado |
| `FACTILIZA_KEY_3` | Configurado |

- Las claves viven como secrets de Supabase Edge Functions.
- No están escritas en el repositorio ni en `js/config.js` publicado.
- Se comprobó que funcionan con consultas reales (ver punto 3).

✅ Secrets configurados y validados.

---

## 3. Edge Functions de DNI y RUC

| Función | Estado | `verify_jwt` | Versión |
|---|---|---|---|
| `consultar-dni` | `ACTIVE` | `true` | 1 |
| `consultar-ruc` | `ACTIVE` | `true` | 1 |

**Pruebas reales del 21/11/2026:**

- DNI `12345678` → `{ "ok": true, "data": { "nombres": "JHON", ... } }`
- RUC `20100070970` → `{ "ok": true, "data": { "nombre_o_razon_social": "SUPERMERCADOS PERUANOS...", "estado": "ACTIVO", "condicion": "HABIDO" } }`

El frontend (`js/services/dniService.js` y `rucService.js`) usa `supabase.functions.invoke`; no llama a Factiliza directamente.

✅ Funciones desplegadas, activas y respondiendo.

---

## 4. URL de redirección de Auth

| Ajuste | Valor |
|---|---|
| Site URL | `https://rodillacafe.vercel.app` |
| Redirect URLs | `https://rodillacafe.vercel.app/**`, preview de Vercel, `http://localhost:8000/**`, `http://localhost:5500/**`, `http://127.0.0.1:8000/**`, `http://127.0.0.1:5500/**` |
| Email + contraseña | Habilitado |
| Registro | Habilitado |
| Autoconfirmación | Habilitada |
| Expiración JWT | 3600 s |

✅ Producción, preview y desarrollo local cubiertos.

---

## 5. RLS y permisos

| Métrica | Resultado |
|---|---|
| Tablas en `public` | 41 |
| Tablas con RLS | **41 (100 %)** |
| Políticas RLS | 68 |
| Tablas con RLS y sin políticas | 0 |
| Políticas para `anon` | 0 |
| Políticas `USING (true)` | 7 (solo `SELECT` de catálogos) |

- No hay escalada de privilegios explotable por `anon`: las funciones de negocio validan `is_admin()` o `is_operativo()`.
- **Hallazgo crítico corregido:** las vistas `PRODUCTO_PUBLICO` y `CATEGORIA_PUBLICO` tenían grants de escritura para `anon` y eran auto-actualizables; se revocaron INSERT/UPDATE/DELETE/TRUNCATE y quedaron solo con `SELECT`. El menú público se verificó después del cambio.

✅ RLS completo y permisos de escritura cerrados.

---

## 6. Configuraciones de seguridad

| Hallazgo | Severidad | Estado |
|---|---|---|
| Vistas públicas con escritura anónima | **Crítica** | ✅ Corregido |
| Funciones `test_*` olvidadas en producción | Media | ✅ Corregido |
| Edge Functions invocables con la clave pública → consumo pagado de Factiliza | Alta | ⚠️ Requiere decisión |
| `search_path` mutable en 2 funciones | Media | ⚠️ Recomendado |
| SSL obligatorio desactivado | Media | ⚠️ Recomendado |
| Contraseña mínima 6, sin HIBP, sin captcha, autoconfirmación | Media | ⚠️ Recomendado |
| Claves API legacy activas | Baja | ⚠️ Recomendado |
| 18 funciones `SECURITY DEFINER` ejecutables por `anon` | Media | ⚠️ Recomendado |

**Advisors de Supabase:** 41 avisos de seguridad y 206 de rendimiento.
Los 2 ERROR restantes son las vistas de catálogo (`security_definer_view`): se documentan como
excepción de diseño porque `security_invoker = on` rompería el menú público (ver auditoría §4.2).

---

## 7. Métricas, registros y monitoreo

| Servicio | Estado |
|---|---|
| db | `ACTIVE_HEALTHY` |
| auth | `ACTIVE_HEALTHY` |
| rest | `ACTIVE_HEALTHY` |
| storage | `ACTIVE_HEALTHY` |
| realtime | `ACTIVE_HEALTHY` |

**Disponible en el plan Free:**

- Logs en Studio (API, Postgres, Auth, Storage, PostgREST, Edge Functions, Realtime) con **1 día** de retención.
- Reports de Database, Auth, Storage, Realtime y Edge Functions.
- Advisors de seguridad y rendimiento.
- Health check de servicios vía Management API.

**No disponible en Free:** log drains, exportación continua, alertas nativas de CPU/consumo, backups automáticos, PITR y SLA.

✅ Monitoreo comprobado; las limitaciones del plan quedan documentadas.

---

## 8. Alertas de disponibilidad y consumo

El plan Free **no permite configurar alertas nativas**. Para cubrir disponibilidad y consumo se
recomienda:

1. **UptimeRobot** (gratuito): monitor HTTP cada 5 min sobre `https://rodillacafe.vercel.app` con
   comprobación de la palabra `Rodilla` y alerta por correo.
2. **GitHub Action programada**: `curl` cada 6 h y apertura de issue si falla.
3. **Revisión semanal de Advisors** (Security + Performance).
4. **Backup manual** antes de cada hito:
   `npx supabase db dump --project-ref zmksxwgikagorgyeyhli -f backup_AAAA-MM-DD.sql`
5. **Configurar el correo de facturación** de la organización (hoy está vacío).
6. Mantener actividad cada semana para evitar la pausa automática del plan Free.

⚠️ Limitación del plan: sin backups automáticos y con pausa tras 1 semana de inactividad.

---

## Cambios aplicados en producción

| Cambio | Detalle | Reversible |
|---|---|---|
| Eliminación de `test_simple_func`, `test_simple_rpc`, `test_facturar`, `test_facturar_venta` | `DROP FUNCTION`; no referenciadas en código ni scripts | Sí |
| Revocación de escritura en `PRODUCTO_PUBLICO` y `CATEGORIA_PUBLICO` | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` a `anon` y `authenticated`; solo queda `SELECT` | Sí |

No se modificaron políticas RLS, configuración de Auth ni Edge Functions.

---

## Pendientes

1. **Opcional:** confirmar acceso a Vercel. No está en la lista oficial de tu parte; solo lo menciona la auditoría del equipo.
2. Decidir si se aplica el paquete de endurecimiento: HIBP + contraseña mínima 8, *Enforce SSL*,
   `search_path` fijo, revocación de `EXECUTE` a `anon` y deshabilitar claves legacy.
3. Coordinar con Mateo las pruebas de integración y el checklist conjunto (su parte incluye errores,
   timeouts, reintentos y pruebas de indisponibilidad).
4. Revocar el token `opencode-cli` al terminar (expira el 28/11/2026).

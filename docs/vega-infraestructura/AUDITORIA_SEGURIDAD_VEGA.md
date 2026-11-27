# Auditoría de Seguridad, RLS y Monitoreo — Rodilla

**Parte:** Jianpierre — Infraestructura cloud
**Proyecto:** Rodilla — Servicios Cloud UTP 2026-II
**Repositorio:** https://github.com/dvid518/rodillacafe
**Proyecto Supabase:** `zmksxwgikagorgyeyhli` (us-west-2, PostgreSQL 17.6, `ACTIVE_HEALTHY`)
**Organización:** Rodilla (plan Free)
**Fecha:** 21/11/2026
**Método:** Supabase CLI 3.2.0 + Management API + SQL Editor (consultas de solo lectura, salvo el punto 6)

---

## 1. Resumen ejecutivo

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Edge Functions invocables con la clave pública → consumo pagado de Factiliza | **Alta** | Requiere decisión |
| 2 | Vistas públicas con permisos de **escritura** para `anon` (borrado/alteración de productos saltándose RLS) | **Crítica** | ✅ **Corregido** (solo `SELECT`) |
| 2b | Vistas `SECURITY DEFINER` para lectura (lint `security_definer_view`) | Media | Excepción documentada |
| 3 | Funciones `test_*` olvidadas en producción (una filtraba pedidos saltándose RLS) | Media | ✅ **Corregido** |
| 4 | 18 funciones `SECURITY DEFINER` ejecutables por `anon` | Media | Recomendado |
| 5 | `search_path` mutable en 2 funciones | Media | Recomendado |
| 6 | SSL obligatorio desactivado y base de datos expuesta a `0.0.0.0/0` | Media | Recomendado |
| 7 | Política de contraseñas débil, sin protección HIBP, sin captcha, autocconfirmación | Media | Recomendado |
| 8 | Claves API legacy (`anon`, `service_role`) activas | Baja | Recomendado |
| 9 | Plan Free sin backups automáticos | **Alta** (disponibilidad) | Recomendado: dump manual |
| 10 | El proyecto se pausa tras **1 semana de inactividad** (plan Free) | **Alta** (disponibilidad) | Mitigar |
| 11 | 162 políticas permisivas múltiples y 42 índices sin uso | Baja (rendimiento) | Informativo |

---

## 2. Configuración del proyecto

| Aspecto | Valor |
|---|---|
| Organización / plan | Rodilla / **Free** |
| Región | `us-west-2` |
| Motor | PostgreSQL 17.6.1.166 |
| Estado | `ACTIVE_HEALTHY` |
| Tamaño de BD | **15 MB** (límite del plan Free: 500 MB) |
| Consumo de MAU / egreso / storage | Sin consumo relevante (límites Free: 50 000 MAU, 5 GB egreso, 1 GB storage) |
| Retención de logs | **1 día** (plan Free) |
| Backups automáticos | **No incluidos** en Free |
| Pausa por inactividad | **Sí, tras 1 semana** |

---

## 3. RLS y permisos

| Métrica | Resultado |
|---|---|
| Tablas en `public` | 41 |
| Tablas con RLS | **41 (100 %)** |
| Políticas RLS | 68 |
| Tablas con RLS pero sin políticas | 0 |
| Políticas para el rol `anon` | **0** |
| Políticas con `USING (true)` | 7 (solo `SELECT` de catálogos) |

Las 7 políticas permisivas son intencionales y de bajo riesgo: catálogo público de solo lectura
(`CATEGORIA_PRODUCTO`, `ESTADO_MESA`, `MESA`, `METODO_PAGO`, `TIPO_ATENCION`, `UNIDAD_MEDIDA`, `ZONA`).

### Grants del rol `anon`

`anon` tiene grants de escritura en 36 tablas, **pero RLS lo bloquea porque no existe ninguna política
para ese rol**. Es el comportamiento por defecto de Supabase; se recomienda revocar escrituras como
defensa en profundidad.

### Funciones `SECURITY DEFINER`

18 funciones son ejecutables por `anon`. Se revisaron las críticas:

| Función | ¿Valida permisos? | Riesgo |
|---|---|---|
| `usp_PromoverAdmin` | Sí (`is_admin()`) | Nulo |
| `usp_linkauthuser` | Sí (`is_admin()`) | Nulo |
| `usp_abrirpedido`, `usp_agregaritempedido`, `usp_facturarpedido`, `usp_anularventa`, `usp_aperturarcaja`, `usp_cerrarcaja`, `usp_registrarmovimientocaja` | Sí (`is_operativo` / `is_admin`) | Nulo |
| `facturar_venta` | Delega en `usp_facturarpedido` (valida) | Bajo |
| `fn_handle_new_user`, `fn_tr_movimiento_caja_acumula`, `rls_auto_enable` | Son triggers, no invocables por RPC | Nulo |

Conclusión: **no hay escalada de privilegios explotable** por `anon`. Aun así, lo correcto es revocar
`EXECUTE` a `anon` en las funciones de negocio.

---

## 4. Hallazgos de seguridad

### 4.1 Edge Functions invocables con la clave pública — **Alta**

`consultar-dni` y `consultar-ruc` tienen `verify_jwt = true`, pero la clave `anon` legacy **es un JWT
válido y es pública** (viaja al navegador). Se comprobó una invocación real con esa clave y respondió
`{ok: true}`.

**Impacto:** cualquier persona con la clave pública puede consumir consultas **pagadas** de Factiliza
sin autenticarse. Es un riesgo económico, no de datos.

**Remediación (elegir una):**
1. Deshabilitar las claves legacy (la app ya usa la publishable key; probar antes el flujo con ella) — cierra la invocación con la clave pública.
2. Validar dentro de la función que exista un usuario autenticado (`auth.getUser()`) y, si aplica, que su rol sea operativo.
3. Añadir rate limiting por IP/usuario.

> Deshabilitar las claves legacy sube la barrera, pero con el registro abierto un atacante aún puede
> crear una cuenta y obtener un JWT. La solución definitiva es la opción 2 o 3.

### 4.2 Vistas públicas: escritura anónima y lectura que se salta RLS — **Crítica → CORREGIDA**

| Vista | Dueño | `security_invoker` | Auto-actualizable | Grants de `anon` (antes) |
|---|---|---|---|---|
| `CATEGORIA_PUBLICO` | `postgres` | No | Sí (máscara 28: INSERT+UPDATE+DELETE) | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER |
| `PRODUCTO_PUBLICO` | `postgres` | No | Sí (máscara 28) | Igual |

Las vistas se ejecutan con los privilegios de `postgres` (dueño de las tablas), por lo que **no se les
aplica RLS**. El diseño de `PRODUCTO_PUBLICO` es intencional (proyección de 8 columnas para el menú,
ver `sql/021_producto_publico.sql`), pero los grants por defecto de Supabase le dieron a `anon` también
INSERT/UPDATE/DELETE sobre la vista. Al ser auto-actualizable, un visitante con la clave pública podía
**borrar o modificar productos sin sesión y sin pasar por RLS**.

**Verificación (sin ejecutar borrados reales):**

- `pg_relation_is_updatable(...) = 28` → INSERT (8) + UPDATE (4) + DELETE (16).
- `has_table_privilege('anon', ..., 'DELETE') = true` antes del cambio.
- `DELETE` vía PostgREST con la clave `anon` → **HTTP 401** después del cambio.

**Acción aplicada:**

```sql
revoke insert, update, delete, truncate, references, trigger
  on public."PRODUCTO_PUBLICO" from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public."CATEGORIA_PUBLICO" from anon, authenticated;
```

Resultado: ambos roles conservan **solo `SELECT`**. El menú público sigue devolviendo datos
(probado: ESPRESSO y AMERICANO).

**Sobre el lint `security_definer_view` (sigue en ERROR):**
Poner `security_invoker = on` **rompería el menú**, porque `anon` no tiene `SELECT` sobre `PRODUCTO`
(y es a propósito: la tabla base expone Costo/Stock). Es una excepción de diseño documentada en
`sql/021_producto_publico.sql`. La alternativa correcta sería dar grants por columna + política RLS
sobre `PRODUCTO` y recién entonces `security_invoker`; queda como mejora opcional, no como bloqueante.

### 4.3 Funciones `test_*` en producción — **Media → CORREGIDO**

Existían 4 funciones `SECURITY DEFINER` sin `search_path` fijo, ejecutables por `anon`:
`test_simple_func`, `test_simple_rpc`, `test_facturar`, `test_facturar_venta`.

`test_facturar` leía `PEDIDO."Numero_Pedido"` **saltándose RLS** (fuga menor de datos).

**Acción aplicada:** eliminadas las 4. Verificado: `quedan = 0`.
No estaban referenciadas en el código ni en los scripts SQL del repo.

### 4.4 `search_path` mutable — **Media**

`usp_setcontextosesion` y `facturar_venta` no fijan `search_path`.

Verificado: ninguna de las dos usa funciones del esquema `extensions` ni `auth.*`, así que fijar
`search_path = public, pg_temp` no altera su lógica.

```sql
alter function public.facturar_venta(integer,integer,integer,integer,text,integer,numeric,character varying,numeric)
  set search_path = public, pg_temp;
alter procedure public.usp_setcontextosesion(...) set search_path = public, pg_temp;
```

### 4.5 SSL y exposición de red — **Media**

| Ajuste | Valor actual |
|---|---|
| SSL obligatorio en la BD | **Desactivado** (`database: false`) |
| CIDRs permitidos | `0.0.0.0/0` y `::/0` |

**Remediación:** activar *Enforce SSL* en Project Settings → Database. Las restricciones de red
están disponibles (`entitlement: allowed`), pero limitar los CIDRs a las IPs del equipo rompería
`supabase db dump` y las migraciones desde IPs dinámicas; se prioriza *Enforce SSL*.

### 4.6 Configuración de Auth — **Media**

| Ajuste | Valor | Recomendación |
|---|---|---|
| Longitud mínima de contraseña | **6** | 8–12 |
| Caracteres obligatorios | Ninguno | Al menos uno de cada tipo |
| Protección de contraseñas filtradas (HIBP) | **Desactivada** | Activar |
| Captcha | Desactivado | Activar si el registro es público |
| Autoconfirmación de correo | **Activada** | Desactivar (verificar correo) |
| Registro abierto | Sí | Mantener solo si es necesario |
| MFA TOTP | Disponible | Sin usuarios enrolados |

### 4.7 Claves legacy — **Baja**

Siguen activas `anon` (legacy) y `service_role` (legacy), además de las nuevas `publishable` y `secret`.
La app ya usa `sb_publishable_...`. Deshabilitar las legacy reduce superficie de ataque.

### 4.8 Disponibilidad — **Alta**

- **Sin backups automáticos** en Free. Supabase recomienda `supabase db dump` periódico.
- **Pausa tras 1 semana de inactividad.** Si el equipo no usa el proyecto antes de la sustentación,
  puede encontrarlo pausado.

**Mitigación:**
```bash
npx supabase db dump --project-ref zmksxwgikagorgyeyhli -f backup_$(date +%F).sql
```
(programar antes de cada entrega y guardar fuera del repo)

---

## 5. Monitoreo, logs y alertas

### Comprobado ahora

| Servicio | Estado |
|---|---|
| db | `ACTIVE_HEALTHY` |
| auth | `ACTIVE_HEALTHY` (GoTrue v2.198.0) |
| rest | `ACTIVE_HEALTHY` (schemas: public, graphql_public) |
| storage | `ACTIVE_HEALTHY` |
| realtime | `ACTIVE_HEALTHY` |

### Funcionalidades disponibles en el plan Free

| Función | Disponibilidad |
|---|---|
| Logs en Studio (API, Postgres, Auth, Storage, PostgREST, Edge Functions, Realtime) | ✅ 1 día de retención |
| Reports (Database, Auth, Storage, Realtime, Edge Functions) | ✅ |
| Advisors de seguridad y rendimiento | ✅ (41 y 206 avisos) |
| Health check de servicios | ✅ (API de Management) |
| Log drains / exportación continua | ❌ (plan pago) |
| Alertas configurables de CPU/consumo | ❌ |
| Backups automáticos / PITR | ❌ |
| SLA | ❌ |

### Evaluación de alertas

El plan Free **no permite configurar alertas nativas** de disponibilidad ni de consumo. El panel
muestra el consumo, pero nadie recibe aviso si el sitio cae o si se acerca al límite.

**Recomendaciones concretas (gratuitas):**

1. **UptimeRobot** (plan gratuito): monitor HTTP cada 5 min sobre
   `https://rodillacafe.vercel.app` con comprobación de palabra clave (`Rodilla`), alerta por correo.
2. **GitHub Action programada** en el repo: `curl` cada 6 h y apertura de issue si falla.
3. **Revisión semanal de Advisors** (Security + Performance) en el panel.
4. **Backup manual** antes de cada hito (`supabase db dump`).
5. **Configurar el correo de facturación** de la organización (hoy está vacío), para que lleguen
   los avisos de la plataforma.
6. Mantener algo de actividad cada semana para evitar la pausa del plan Free.

---

## 6. Cambios aplicados en producción

| Cambio | Detalle | Reversible |
|---|---|---|
| Eliminación de `test_simple_func`, `test_simple_rpc`, `test_facturar`, `test_facturar_venta` | DDL `DROP FUNCTION`; no referenciadas en código ni scripts | Sí (se pueden recrear) |
| Revocación de escritura en `PRODUCTO_PUBLICO` y `CATEGORIA_PUBLICO` | `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` a `anon` y `authenticated`; queda solo `SELECT` | Sí (con `GRANT` de vuelta) |

No se modificaron políticas RLS, configuración de Auth ni Edge Functions.

---

## 7. Plan de acción recomendado (por prioridad)

| Orden | Acción | Responsable | Impacto |
|---|---|---|---|
| 1 | Deshabilitar claves legacy o validar usuario en las Edge Functions | Vega + Mateo | Cierra abuso de Factiliza |
| 2 | Activar HIBP y subir contraseña mínima a 8 | Vega | Endurece Auth |
| 3 | Activar *Enforce SSL* | Vega | Cifra conexiones a la BD |
| 4 | `search_path` fijo en 2 funciones | Vega | Elimina 2 avisos |
| 5 | Vistas: mantener la excepción documentada; opcional grants por columna + `security_invoker` | Vega + Mateo | Cierra el lint ERROR sin romper el menú |
| 6 | Revocar `EXECUTE` de `anon` en funciones de negocio | Vega | Defensa en profundidad |
| 7 | Backup manual + monitor UptimeRobot | Vega | Disponibilidad |

---

## 8. Evidencia

- `supabase projects list` → proyecto `zmksxwgikagorgyeyhli`, `ACTIVE_HEALTHY`.
- SQL de conteo: 41 tablas, 41 con RLS, 68 políticas, 0 sin políticas.
- SQL de funciones: 4 `is_*`, 10 `usp_*`; 18 `SECURITY DEFINER` ejecutables por `anon`.
- Advisors seguridad: 41 avisos (2 ERROR de vistas —solo lectura, escritura revocada—, 2 `search_path`, 18+18 ejecutables, 1 HIBP).
- Vistas: `pg_relation_is_updatable = 28` y grants de escritura a `anon`; tras el `REVOKE`, `anon` solo tiene `SELECT`, el menú devuelve ESPRESSO/AMERICANO y `DELETE` responde **HTTP 401**.
- Advisors rendimiento: 206 avisos (162 políticas múltiples, 42 índices sin uso, 2 initplan).
- Invocación real `consultar-dni` y `consultar-ruc` → `{ok: true}` con datos.
- `GET /health` → los 5 servicios `ACTIVE_HEALTHY`.
- Retención de logs Free = 1 día (documentación oficial de Supabase).
- Free sin backups automáticos y pausa tras 1 semana de inactividad (documentación oficial).

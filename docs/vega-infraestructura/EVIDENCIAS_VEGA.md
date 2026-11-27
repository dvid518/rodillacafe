# Evidencias — Parte Vega (Infraestructura Cloud)

**Proyecto:** Rodilla — Servicios Cloud UTP 2026-II
**Repositorio:** https://github.com/dvid518/rodillacafe
**Proyecto Supabase:** `zmksxwgikagorgyeyhli` (us-west-2, estado `ACTIVE_HEALTHY`)
**Fecha de verificación:** 21/11/2026
**Verificado con:** CLI de Supabase 3.2.0 + Management API, autorizado por la cuenta Techruss (Vega)

---

## 1. Acceso

- [x] Panel de Supabase accesible (organización **Rodilla**, plan Free)
- [x] CLI autenticada: `supabase projects list` devuelve el proyecto
- [ ] (Opcional) Panel de Vercel — no forma parte de los 8 puntos del chat; solo lo menciona la auditoría del equipo.

## 2. RLS y base de datos

| Métrica | Resultado |
|---|---|
| Tablas en `public` | **41** |
| Tablas con RLS habilitado | **41 (100 %)** |
| Políticas RLS | **68** |
| Funciones `is_*` | **4** |
| Procedimientos `usp_*` | **10** |
| Tablas sin RLS | **0** |

Consulta usada:

```sql
select
  (select count(*) from pg_tables where schemaname='public') as tablas,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as tablas_con_rls,
  (select count(*) from pg_policies where schemaname='public') as politicas,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and left(p.proname,3)='is_') as funciones_is,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and left(p.proname,4)='usp_') as procedimientos_usp;
```

## 3. Auth

| Ajuste | Valor |
|---|---|
| Site URL | `https://rodillacafe.vercel.app` |
| Redirect URLs | `https://rodillacafe.vercel.app/**`, preview de Vercel, `localhost:8000`, `localhost:5500`, `127.0.0.1` |
| Email + contraseña | Habilitado |
| Registro (signup) | Habilitado |
| Autoconfirmación de correo | Habilitado |
| Expiración JWT | 3600 s |

## 4. Secrets de Factiliza

| Secret | Estado |
|---|---|
| `FACTILIZA_KEY_1` | Configurado |
| `FACTILIZA_KEY_2` | Configurado |
| `FACTILIZA_KEY_3` | Configurado |

Ninguna clave está escrita en el repositorio.

## 5. Edge Functions

| Función | Estado | `verify_jwt` | Versión |
|---|---|---|---|
| `consultar-dni` | ACTIVE | `true` | 1 |
| `consultar-ruc` | ACTIVE | `true` | 1 |

### Pruebas de invocación (21/11/2026)

**`consultar-dni`** con DNI `12345678`:

```json
{ "ok": true, "data": { "numero": "12345678", "...": "datos personales omitidos" } }
```

**`consultar-ruc`** con RUC `20100070970`:

```json
{
  "ok": true,
  "data": {
    "numero": "20100070970",
    "nombre_o_razon_social": "SUPERMERCADOS PERUANOS SOCIEDAD ANONIMA 'O' S.P.S.A.",
    "estado": "ACTIVO",
    "condicion": "HABIDO",
    "departamento": "LIMA",
    "provincia": "LIMA",
    "distrito": "SAN BORJA"
  }
}
```

Ambas respuestas confirman que las claves de Factiliza están activas y que las funciones llegan al proveedor.

## 6. Frontend

- `js/services/dniService.js` usa `supabase.functions.invoke("consultar-dni", ...)`.
- `js/services/rucService.js` usa `supabase.functions.invoke("consultar-ruc", ...)`.
- No hay llamadas directas a `api.factiliza.com` desde el código del navegador.
- `js/config.js` publicado en producción **no contiene claves** de Factiliza (solo las URLs, que ya no se usan).
- `https://rodillacafe.vercel.app` responde **HTTP 200**.
- `dashboard.html` carga y su controlador importa `guardSesion` (redirige a login sin sesión).

## 7. Checklist de aceptación (tareas 1-6 de la auditoría)

- [x] Acceso al panel de Supabase confirmado
- [x] RLS activo en las 41 tablas
- [x] 68 políticas RLS vigentes
- [x] Auth por email/contraseña activo
- [x] `rodillacafe.vercel.app` registrado como URL autorizada
- [x] `FACTILIZA_KEY_1/2/3` configuradas como secrets
- [x] `consultar-dni` desplegada y respondiendo `{ok: true}`
- [x] `consultar-ruc` desplegada y respondiendo `{ok: true}`
- [x] Frontend consume las Edge Functions (no Factiliza directo)
- [x] Producción operativa
- [ ] Acceso al panel de Vercel — confirmar

## 8. Observaciones

1. **`supabase/.temp/` está commiteado** en el repositorio (incluye `project-ref` y `linked-project.json`). No debería subirse: eliminar del repo y añadir `supabase/.temp/` al `.gitignore`.
2. **`API_DNI_URL` y `API_RUC_URL` en `js/config.js`** ya no se usan (el frontend llama a las Edge Functions). Se pueden eliminar para evitar confusión.
3. El token `opencode-cli` se creó para esta verificación, expira el **28/11/2026** y se puede revocar en *Account → Access Tokens*.
4. **Vistas públicas:** se revocaron los permisos de escritura de `anon`/`authenticated` sobre `PRODUCTO_PUBLICO` y `CATEGORIA_PUBLICO` (quedaron solo con `SELECT`). El detalle está en `AUDITORIA_SEGURIDAD_VEGA.md` §4.2.

# Auditoria Técnica — Rodilla (Proyecto Servicios Cloud, UTP 2026-II)

**Repositorio auditado:** `C:\Users\david\Downloads\David\prog\rodillacafe`
**Modalidad:** solo lectura. No se modificaron archivos, ni bases de datos, ni se desplegó infraestructura.
**Fecha:** Domingo 15 de noviembre de 2026
**Auditor:** agente de código (OpenCode), nivel ponytail full

---

## 1. Objetivos

1. Identificar la arquitectura actual del proyecto.
2. Identificar frontend, backend, base de datos, autenticación, almacenamiento y servicios externos.
3. Identificar cómo se ejecuta y despliega actualmente.
4. Evaluar qué componentes pueden dockerizarse y desplegarse en Google Cloud Run.
5. Determinar qué servicios de GCP aportarían valor real.
6. Identificar qué servicios existentes de Vercel y Supabase conviene conservar.
7. Evaluar la necesidad de VPC, máquinas virtuales, Cloud SQL, Cloud Storage, IAM, Secret Manager, Artifact Registry, Cloud Logging y Cloud Monitoring.
8. Evaluar Terraform y CI/CD.
9. Identificar riesgos de seguridad, costos y complejidad innecesaria.

## 2. Alcance y restricciones

- **Solo lectura.** Cero modificaciones al código, a los scripts SQL, a Supabase ni a Vercel.
- **No se expone ningún secreto.** `js/config.js` muestra la Supabase *publishable key* (pública por diseño) y URLs de API; no se transcriben claves secretas de Factiliza ni credenciales de ningún proveedor.
- **Se diferencia estrictamente** lo que YA EXISTE de lo que HAY QUE IMPLEMENTAR.
- El resultado está alineado con el sílabo de Servicios Cloud de UTP 2026-II, priorizando arquitectura funcional, segura, económica y técnicamente justificable.

---

## 3. Arquitectura actual (lo que existe)

### 3.1 Vista general

```
┌─────────────────────── NAVEGADOR / USUARIO ───────────────────────┐
│                                                                   │
│  index.html   (landing público: home, menú, reservas, contacto)   │
│  auth.html    (login / registro)                                  │
│  dashboard.html (panel admin / cajero / mozo / cliente)           │
│                                                                   │
│  js/controllers/  →  js/views/  →  js/services/  →  js/adapters/  │
│                                                                   │
│  └─▶  Supabase JS SDK v2 (CDN esm.sh)  →  Supabase (PostgreSQL)   │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │   VERCEL (hosting estático)   │
                 │   https://rodillacafe.vercel.app │
                 └──────────────────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │   SUPABASE (BaaS)        │
                 │   PostgreSQL + Auth + RLS │
                 │   https://zmksxwgikagorgyeyhli.supabase.co │
                 └──────────────────────────┘
```

### 3.2 Capas y componentes

| Capa | Ubicación | Tecnología | Qué hace | Estado |
|------|-----------|------------|----------|--------|
| Frontend | `index.html`, `auth.html`, `dashboard.html`, `views/`, `css/`, `js/` | HTML5 + CSS3 + JS módulos ES nativos (vanilla) | Landing, login, panel, carrito, router hash-based | Existe |
| Cliente de datos | `js/lib/supabaseClient.js` | `@supabase/supabase-js@2` desde esm.sh | Instancia única del cliente Supabase | Existe |
| Adapters (puerta a datos) | `js/adapters/` (14 archivos) | Supabase PostgREST / Auth / RPC | Única capa que habla con Supabase | Existe |
| Services (reglas de negocio) | `js/services/` (16 archivos) | JS vanilla | Lógica de negocio, contrato `{ok,data|error}` | Existe |
| Session / guards | `js/session/` | JS vanilla | `guard.js`, `roleGuard.js`, `opcionalSesion.js` | Existe |
| Base de datos | Supabase (PostgreSQL gestionado) | `sql/` (23 scripts, aplicados a mano en SQL Editor) | 41 tablas, 1 vista, 67 políticas RLS, 3 triggers, 4 funciones `is_*`, 9 procedimientos `usp_*` | Existe |
| Autenticación | Supabase Auth (GoTrue) | Email + contraseña, JWT de sesión | Registro, login, cierre, trigger `fn_handle_new_user()` | Existe |
| Almacenamiento de archivos | Ninguno (no hay bucket ni Storage de Supabase activo) | — | Las imágenes de producto son `varchar(200)` (ruta/URL texto), no archivos subidos | Ausente |
| Servicios externos | `js/config.js` | `api.factiliza.com` (DNI/RUC) | Consulta de DNI y RUC desde el frontend | Existe (claves expuestas, ver riesgo) |
| Hosting estático | Vercel | `vercel.json` + `.vercelignore` | Despliegue estático, reescrituras SPA, cabeceras de seguridad | Existe |
| Analítica | Vercel Web Analytics | `js/lib/analytics.js` | Pageviews por ruta hash-based | Existe |
| Servidor local de dev | `server.py` / `dev-server.py` | Python stdlib `http.server` | SPA fallback, Content-Type correctos para ES modules, localhost:8000 | Existe (solo desarrollo local) |

### 3.3 Base de datos (inventario clave)

- Motor: PostgreSQL gestionado por Supabase.
- 41 tablas, 1 vista (`PRODUCTO_PUBLICO`), 67 políticas RLS (100 % de tablas con RLS), 61 índices, 3 triggers, 4 funciones de autorización (`is_admin`, `is_rol`, `is_operativo`, `is_owner_cliente`), 9 procedimientos `usp_*`.
- 4 roles: ADMINISTRADOR, CAJERO, MOZO, CLIENTE.
- Columnas de auditoría en todas las tablas: `USUCRE`, `PCCRE`, `FECCRE`, `USUMOD`, `PCMOD`, `FECMOD`, `ESTADO`.
- Puente auth → dominio: `USUARIO.auth_id` (UUID) ↔ `auth.users`.

### 3.4 Cómo se ejecuta localmente

1. `python server.py` (o `python dev-server.py`) → `http://localhost:8000`.
2. Sirve archivos estáticos con Content-Type correctos para módulos ES6.
3. Reescritura SPA: `/dashboard/*` → `dashboard.html`, `/auth/*` → `auth.html`, resto → `index.html`.
4. No hay `package.json`, no hay bundler, no hay `node_modules`. El navegador ejecuta los módulos ES tal cual.

### 3.5 Cómo se despliega actualmente

- **Vercel** (estático). Repositorio vinculado, despliegue automático por push.
- `vercel.json`: `cleanUrls`, `trailingSlash`, reescrituras (`/dashboard`, `/auth`, fallback `/index.html`), cabeceras de seguridad y caché.
- `.vercelignore`: excluye `sql/`, `work/`, `.git/`, `*.md`, `*.code-workspace`, `firebase.json`, `.firebaserc`, `supabase/`, `node_modules/`, `.env`, `.env.local`.
- **Importante:** `sql/` NO se despliega. El esquema se aplica a mano en el SQL Editor de Supabase, en orden numérico (`001_extensions.sql` … `021_producto_publico.sql`).
- URL de producción: `https://rodillacafe.vercel.app`.

### 3.6 Servicios externos y claves

| Servicio | Uso | Dónde se configura | Riesgo |
|----------|-----|--------------------|--------|
| Supabase | BD, Auth, RLS, Edge Functions | Panel de Supabase (`ref = zmksxwgikagorgyeyhli`) | URL y publishable key van en `js/config.js` (públicas por diseño, OK) |
| Factiliza | Consulta DNI/RUC | `js/config.js` expone `API_DNI_URL` / `API_RUC_URL` | Las Edge Functions ya existen (`supabase/functions/consultar-dni`, `consultar-ruc`) pero requieren `FACTILIZA_KEY_1/2/3` como secrets de Supabase; no desplegadas ni configuradas |
| Vercel | Hosting estático + analítica | Panel de Vercel | OK, gratuito para este uso |

---

Esto cubre la parte 1 (contexto, alcance, arquitectura actual). En la siguiente parte agrego: servicios existentes de Vercel/Supabase a conservar, evaluación de dockerización y Cloud Run, y servicios de GCP recomendados.

---

## 4. Servicios existentes de Vercel y Supabase que conviene conservar

| Servicio | Qué aporta | Recomendación | Justificación |
|----------|-----------|---------------|---------------|
| **Vercel hosting estático** | Entrega del frontend (HTML/CSS/JS), CDN global, reescrituras SPA, cabeceras de seguridad, analítica web | **Conservar** | El frontend es 100 % estático (vanilla JS, sin build). Vercel lo sirve gratis, con edge network y HTTPS. Moverlo a Cloud Run añadiría costo y complejidad sin beneficio. |
| **Vercel Web Analytics** | Pageviews por ruta (adaptado al router hash) | **Conservar** | Cero dependencias, ya integrado en `js/lib/analytics.js`. Sustituirlo por Cloud Monitoring requeriría instrumentar el frontend con un SDK de GCP. |
| **Supabase PostgreSQL** | Base de datos relacional con 41 tablas, índices, procedimientos | **Conservar** | Es el núcleo del sistema. Migrarlo a Cloud SQL implicaría exportar/importar esquema, reconfigurar conexión, gestionar backups y parches. Supabase ya es PostgreSQL gestionado. |
| **Supabase Auth (GoTrue)** | Registro, login, JWT, manejo de sesiones | **Conservar** | Está probado y vinculado a `USUARIO.auth_id`. Moverlo a Firebase Auth o Identity Platform rompería el puente `auth_id` y todas las políticas RLS. |
| **Supabase RLS (Row Level Security)** | 67 políticas que filtran filas/columnas en el motor | **Conservar** | Es la frontera de seguridad real. Replicarla en una capa de aplicación de Cloud Run reabriría riesgos de escalada de privilegios. |
| **Supabase Edge Functions** | `consultar-dni` y `consultar-ruc` (ya creadas, pendiente de deploy y secrets) | **Conservar y desplegar** | Resuelven el riesgo crítico de claves Factiliza expuestas en el frontend. Las claves irían en Secret Manager-equivalente de Supabase (variables de entorno secretas). |

**Regla de conservación:** todo lo que es estático, ya gestionado y sin estado se queda en Vercel/Supabase. Solo lo que requiera lógica de servidor propia con control total (si apareciera en el futuro) se llevaría a Cloud Run.

---

## 5. Evaluación de dockerización y despliegue en Google Cloud Run

### 5.1 ¿Qué se puede dockerizar?

El proyecto actual **no tiene backend propio ni aplicación de servidor**: el frontend es estático y la lógica de negocio vive en Supabase. Por tanto:

| Componente | ¿Dockerizable? | ¿Desplegable en Cloud Run? | Recomendación |
|------------|---------------|---------------------------|---------------|
| Frontend (HTML/CSS/JS vanilla) | Sí (imagen nginx/alpine estática) | Sí, pero innecesario | **No.** Mejor en Vercel (gratis, CDN, sin servidor que mantener). |
| Supabase (PostgreSQL + Auth + RLS) | No (es SaaS gestionado) | No | **No.** Supabase no se dockeriza; se consume como servicio. |
| Edge Functions (DNI/RUC) | No (son funciones de Supabase) | No | **No.** Se despliegan en la plataforma de Supabase. |
| Backend propio futuro (si se añade) | Sí | Sí | Solo si surge una necesidad real (p. ej. integración con SUNAT, pagos, email transaccional). |

### 5.2 Conclusión sobre Cloud Run

**Cloud Run no aporta valor al proyecto en su estado actual.** No hay una aplicación de servidor que contenerizar. Introducirlo sería complejidad innecesaria (Dockerfile, Cloud Build, Artifact Registry, IAM de invocación, secretos, health checks, mínimo de instancias, costo por uso) para ganar cero funcionalidad.

**Cuándo sí tendría sentido Cloud Run:** si el proyecto crece y necesita un backend propio (por ejemplo, un microservicio de facturación electrónica SUNAT, envío de correos, o proxy de pagos). Ese es un escenario "para después", no para esta entrega.

---

## 6. Servicios de GCP: ¿aportan valor real?

Evaluación servicio por servicio, con recomendación de implementar (I), conservar/externo (C) o descartar (D) para este proyecto universitario.

| Servicio | ¿Para qué serviría en Rodilla? | Recomendación | Justificación |
|----------|-------------------------------|---------------|---------------|
| **Artifact Registry** | Almacenar imágenes Docker de Cloud Run | **D** (por ahora) | No hay contenedores que guardar. Solo si se adopta Cloud Run en el futuro. |
| **Cloud Logging** | Logs de la aplicación y de Cloud Run | **C** (opcional) | Vercel y Supabase ya proveen logs. Agregar Cloud Logging solo si se despliega algo en GCP. |
| **Cloud Monitoring** | Métricas y alertas de infraestructura | **C** (opcional) | Vercel Analytics + Supabase metrics cubren el monitoreo actual. |
| **Secret Manager** | Almacenar claves de Factiliza, claves de API, credenciales | **I** (si se usa GCP) | Las Edge Functions de Supabase ya admiten secrets nativos. Si se mueve algo a Cloud Run, aquí irían los secretos. |
| **IAM** | Control de acceso a recursos de GCP | **C** | Implícito en cualquier proyecto de GCP; no requiere configuración adicional para este alcance. |
| **Cloud Storage** | Almacenar imágenes de productos, comprobantes, archivos | **D** (por ahora) | Rodilla no sube archivos: las imágenes son rutas de texto (`varchar`). No hay necesidad de bucket. |
| **Cloud SQL** | Base de datos relacional gestionada de GCP | **D** | Supabase ya es PostgreSQL gestionado. Migrar a Cloud SQL es costo y trabajo sin beneficio. |
| **VPC** | Red privada entre recursos de GCP | **D** | No hay recursos de GCP que interconectar de forma privada. Vercel y Supabase son públicos por diseño. |
| **Máquinas virtuales (Compute Engine)** | Servidores persistentes | **D** | Sobrekill para un proyecto académico. Sin estado, sin servidor propio, sin tareas por lotes. |
| **Cloud Run** | Contenedores sin servidor | **D** (por ahora) | No hay aplicación de servidor que contenerizar. |

**Resumen de GCP:** para este proyecto no se justifica desplegar nada en GCP. El valor real de GCP para Rodilla aparecería solo si se añade un backend propio en el futuro. Hasta entonces, la arquitectura óptima es **Vercel + Supabase**, con Secret Manager de Supabase (variables de entorno secretas) para las claves de Factiliza.

---

Esto completa las partes 4-6. En la siguiente parte agrego: riesgos de seguridad/costo/complejidad, Terraform y CI/CD, y la matriz de implementación con orden, dependencias, dificultad y división de trabajo.

---

## 7. Riesgos identificados (seguridad, costos, complejidad)

### 7.1 Seguridad

| Riesgo | Descripción | Severidad | Mitigación existente / propuesta |
|--------|-------------|-----------|----------------------------------|
| Claves de Factiliza expuestas | `js/config.js` exponía 3 JWT en el bundle público (detectado en `AUDITORIA_AVANCE3.md`). El `REPORTE_FINAL_AVANCE3.md` indica que ya se eliminó de `js/config.js` y se crearon Edge Functions, pero requieren secrets de Supabase para funcionar. | Crítica | Desplegar Edge Functions y configurar `FACTILIZA_KEY_1/2/3` como variables de entorno secretas de Supabase. |
| Publishable key de Supabase en frontend | Va en `js/config.js` y viaja al navegador. | Baja (aceptable) | Es la publishable key, pública por diseño. La seguridad real está en RLS, no en ocultar la clave. |
| No hay bucket de Storage | Las imágenes de producto son `varchar(200)` (texto), no archivos subidos. | Media | Si se requiere subir imágenes en el futuro, usar Supabase Storage con RLS en el bucket. |
| RLS no evidenciado en producción | No se verificó que las políticas RLS estén activas en el proyecto Supabase de producción. | Media | Verificar en el panel de Supabase que RLS esté habilitado y que las 67 políticas estén aplicadas. |
| Redirect URLs de Auth no verificadas | No se evidenció configuración de dominios autorizados/redirect URLs en Supabase Auth para producción (`rodillacafe.vercel.app`). | Media | Configurar `https://rodillacafe.vercel.app` como URL autorizada en Supabase Auth. |

### 7.2 Costos

| Servicio | Modelo de costo | Impacto en este proyecto |
|----------|----------------|--------------------------|
| Vercel (Hobby) | Gratis para sitios estáticos personales/académicos | Cero costo. Suficiente para Rodilla. |
| Supabase (Free tier) | 500 MB BD, 2 GB ancho de banda, Auth incluido | Suficiente para 41 tablas y uso académico. |
| GCP (Cloud Run, Cloud SQL, etc.) | Pago por uso | Se evita por ahora: cero costo de GCP mientras no se agregue backend propio. |
| Factiliza | Pago por consulta DNI/RUC | Costo externo, fuera de GCP. Mitigado por buscar primero en BD (`PERSONA`, `EMPRESA`). |

### 7.3 Complejidad innecesaria

- **No dockerizar el frontend:** añadiría Dockerfile, Cloud Build, Artifact Registry y Cloud Run para servir archivos estáticos que Vercel ya sirve gratis.
- **No migrar Supabase a Cloud SQL:** rompería el puente `auth_id`, RLS, Edge Functions y Auth, sin beneficio.
- **No usar VPC ni VMs:** no hay recursos de GCP que interconectar de forma privada ni servidores que mantener.
- **No usar Terraform por ahora:** la infraestructura es mínima (Vercel + Supabase), gestionada desde sus paneles. Terraform añadiría curval de aprendizaje y estado que manejar sin justificación en este alcance. Se puede evaluar en una segunda fase si se adopta GCP.

---

## 8. Terraform y CI/CD

| Aspecto | Evaluación para Rodilla (2026-II) | Recomendación |
|---------|----------------------------------|---------------|
| **Terraform** | Infraestructura mínima: un sitio estático en Vercel y una instancia de Supabase. Ambos se gestionan desde consola web. No hay recursos de GCP que provisionar. | **No aplicar por ahora.** Solo tiene sentido si se despliega algo en GCP (Cloud Run, Secret Manager, etc.) y se quiere infraestructura como código. |
| **CI/CD** | Vercel despliega automáticamente por push al repositorio (Git). No hay pipeline de pruebas ni de build (no hay `package.json` ni bundler). | **Mantener el despliegue automático de Vercel.** Opcional: agregar un GitHub Action sencillo que ejecute `grep` de secretos y valide que `js/config.js` no contenga claves de Factiliza (check de seguridad pre-despliegue). |

---

## 9. Dependencias y orden de implementación

### 9.1 Dependencias lógicas

1. **Acceso a Supabase** (Vega): necesario antes de cualquier cambio de backend o Edge Functions.
2. **Acceso a Vercel** (Vega): necesario para confirmar el despliegue actual y dominios autorizados.
3. **Claves de Factiliza** (usuario/docente): necesarias para configurar secrets de las Edge Functions. Sin ellas, el criterio "API DNI/RUC segura" no se cumple.
4. **Frontend sin cambios** (Mateo): como el frontend es estático y ya está en Vercel, no requiere modificaciones para la arquitectura cloud recomendada.

### 9.2 Orden de implementación

| Orden | Tarea | Quién | Depende de |
|-------|-------|-------|------------|
| 1 | Confirmar acceso al panel de Supabase (`ref: zmksxwgikagorgyeyhli`) y Vercel | Vega | — |
| 2 | Verificar RLS activo (41 tablas, 67 políticas) y Auth en producción | Vega | 1 |
| 3 | Configurar `FACTILIZA_KEY_1/2/3` como secrets de Supabase | Usuario/docente | 1 |
| 4 | Desplegar Edge Functions `consultar-dni` y `consultar-ruc` en Supabase | Vega | 3 |
| 5 | Verificar que el frontend llame a las Edge Functions y no a Factiliza directamente | Mateo | 4 |
| 6 | Configurar `rodillacafe.vercel.app` como redirect URL autorizado en Supabase Auth | Vega | 1 |
| 7 | Documentar arquitectura cloud recomendada y decisiones de no-adopción de GCP | Huarcaya | 1, 2 |
| 8 | Checklist de aceptación (ver §10) | Mateo + Vega | 2, 4, 6 |

### 9.3 Tiempo estimado

- Tareas 1-2 (verificación): 0.5 día (Vega)
- Tarea 3 (secrets de Factiliza): 0.25 día (usuario/docente, requiere claves reales)
- Tarea 4 (desplegar Edge Functions): 0.5 día (Vega)
- Tarea 5 (verificación frontend): 0.5 día (Mateo)
- Tarea 6 (redirect URLs): 0.25 día (Vega)
- Tarea 7 (documentación): 1 día (Huarcaya)
- Tarea 8 (checklist): 0.5 día (Mateo + Vega)

**Total estimado: ~3.5 días** (sin contar la obtención de las claves de Factiliza, que depende del usuario/docente).

---

Esto completa las secciones 7-9. En la última parte agrego: división de trabajo entre Mateo/Vega/Huarcaya y los criterios de aceptación verificables por tarea.

---

## 10. División del trabajo

### Perfiles

| Integrante | Perfil | Habilidades |
|------------|--------|-------------|
| **Mateo** | Desarrollador full-stack | Frontend vanilla JS, servicios, adapters, sesión, rol |
| **Vega** | Infraestructura cloud | Supabase panel, Vercel panel, Edge Functions, secrets, IAM básico (habilidades técnicas por determinar) |
| **Huarcaya** | Documentación | Informes, arquitectura, criterios de aceptación, evidencias |

### Matriz de responsabilidad (RACI simplificada)

| Tarea | Mateo | Vega | Huarcaya |
|-------|-------|------|----------|
| Verificar acceso Supabase y Vercel | — | R/A | I |
| Verificar RLS y Auth en producción | — | R/A | I |
| Conseguir claves de Factiliza (usuario/docente) | — | — | — (gestiona el usuario) |
| Configurar secrets `FACTILIZA_KEY_1/2/3` | — | R | I |
| Desplegar Edge Functions DNI/RUC | — | R/A | I |
| Verificar frontend llama a Edge Functions | R/A | C | I |
| Configurar redirect URL en Supabase Auth | — | R/A | I |
| Documentar arquitectura cloud recomendada | C | C | R/A |
| Checklist de aceptación | R | R | C |
| Evidencias y capturas para sustentación | R | C | R |

**Leyenda:** R = responsable (hace el trabajo), A = aprobador (valida que esté bien), C = consultado, I = informado.

### Reparto por horas (estimado)

- **Mateo:** ~2 horas (verificar Edge Functions desde frontend + checklist).
- **Vega:** ~3 horas (acceso Supabase/Vercel, verificar RLS/Auth, configurar secrets, desplegar Edge Functions, configurar redirect URL).
- **Huarcaya:** ~8 horas (documentar arquitectura, criterios de aceptación, evidencias).

---

## 11. Criterios de aceptación verificables por tarea

Cada criterio se puede comprobar con acciones concretas en el navegador o en los paneles de Supabase/Vercel, sin modificar código ni desplegar infraestructura nueva.

### Tarea 1 — Confirmar acceso a Supabase y Vercel
- [ ] Vega puede entrar al panel de Supabase del proyecto `zmksxwgikagorgyeyhli`.
- [ ] Vega puede entrar al panel de Vercel del proyecto `rodillacafe`.
- [ ] Se confirma la URL de producción: `https://rodillacafe.vercel.app`.

### Tarea 2 — Verificar RLS y Auth en producción
- [ ] En el SQL Editor de Supabase se confirma que las 41 tablas tienen RLS habilitado.
- [ ] Se cuentan 67 políticas RLS vigentes (archivo `sql/014_rls_policies.sql`).
- [ ] Se confirma que Supabase Auth está activo (método email + contraseña).
- [ ] No hay JWT ni claves de Factiliza visibles en `js/config.js` ni en el bundle del navegador.

### Tarea 3 — Configurar secrets de Factiliza
- [ ] `FACTILIZA_KEY_1`, `FACTILIZA_KEY_2`, `FACTILIZA_KEY_3` están configuradas como variables de entorno secretas en Supabase (panel → Settings → Edge Functions → Secrets, o equivalente).
- [ ] Ninguna clave está escrita en texto plano en el repositorio.

### Tarea 4 — Desplegar Edge Functions DNI/RUC
- [ ] `supabase functions deploy consultar-dni` ejecutado con éxito.
- [ ] `supabase functions deploy consultar-ruc` ejecutado con éxito.
- [ ] Invocar `consultar-dni` con un DNI válido devuelve `{ ok: true, data: {...} }`.
- [ ] Invocar `consultar-ruc` con un RUC válido devuelve `{ ok: true, data: {...} }`.

### Tarea 5 — Verificar frontend consume Edge Functions
- [ ] `dniService.consultarDNI()` llama a `supabase.functions.invoke("consultar-dni", ...)` y no a `api.factiliza.com` directamente.
- [ ] `rucService.consultarRUC()` llama a `supabase.functions.invoke("consultar-ruc", ...)` y no a `api.factiliza.com` directamente.
- [ ] El flujo autocompletado busca primero en BD (`PERSONA` / `EMPRESA`) antes de invocar la Edge Function.

### Tarea 6 — Configurar redirect URL en Supabase Auth
- [ ] `https://rodillacafe.vercel.app` está registrado como URL de redirección autorizada en Supabase Auth.
- [ ] El login desde producción redirige correctamente tras autenticación.

### Tarea 7 — Documentación (Huarcaya)
- [ ] Existe este documento de auditoría (`AUDITORIA_CLOUD_RODILLA.md`).
- [ ] Describe la arquitectura actual y la arquitectura cloud recomendada.
- [ ] Justifica qué servicios de GCP no se implementan y por qué.
- [ ] Incluye la división de trabajo Mateo/Vega/Huarcaya con horas estimadas.
- [ ] Incluye criterios de aceptación verificables (esta sección).

### Tarea 8 — Checklist de aceptación final
- [ ] El dashboard carga y redirige a login si no hay sesión (`guardSesion`).
- [ ] El Sidebar muestra módulos según el rol (ADMINISTRADOR vs CAJERO vs MOZO vs CLIENTE).
- [ ] No hay claves de Factiliza expuestas en el código fuente del navegador.
- [ ] Las Edge Functions DNI/RUC responden correctamente desde Supabase.
- [ ] La URL de producción `https://rodillacafe.vercel.app` está operativa.

---

## 12. Conclusión ejecutiva

Rodilla ya tiene una arquitectura sólida y adecuada para un proyecto universitario: **frontend estático en Vercel + Supabase (PostgreSQL, Auth, RLS, Edge Functions)**. No hay backend propio que contenerizar, por lo que **Google Cloud Run no aporta valor en esta fase** y se descarta, junto con Cloud SQL, VPC, VMs, Cloud Storage y Artifact Registry.

El único trabajo de infraestructura pendiente es completar las Edge Functions de DNI/RUC (desplegarlas y configurar sus secrets en Supabase), lo cual elimina el riesgo crítico de claves expuestas en el frontend. Todo lo demás (Vercel, Supabase, Auth, RLS) se conserva tal cual.

La arquitectura cloud recomendada es, por tanto, **mantener y completar lo existente**, no migrar a GCP. Esto cumple el sílabo de Servicios Cloud de UTP 2026-II con una arquitectura funcional, segura, económica y técnicamente justificable.

---

**Fin de la auditoría. Solo lectura y análisis; ningún archivo del repositorio fue modificado. No se expusieron secretos ni credenciales.**

shortcut: informe completo entregado en AUDITORIA_CLOUD_RODILLA.md (12 secciones). No se ejecutó ni se modificó nada en el repositorio.

Riesgo: las tareas 3 y 4 dependen de que el usuario/docente proporcione las claves reales de Factiliza y de acceso al panel de Supabase; sin ellas no se puede completar el criterio de API DNI/RUC segura.
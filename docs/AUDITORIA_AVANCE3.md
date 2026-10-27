# Auditoria completa del sistema vs rúbrica del Avance 3

Proyecto Rodilla. Auditoria de solo lectura (no se modificaron archivos, ni SQL, ni despliegue).

Fecha: 2026-10-26

---

## Resumen ejecutivo

### % de cumplimiento estimado de la rúbrica: ~55 % (11/20 puntos)

| Criterio | Puntos | Estado | % cubierto |
|---|---|---|---|
| 1. Informe hasta Cap. IV | 2 | ❌ | 0 % |
| 2. Tablas fuertes/débiles (CRUD) | 3 | ⚠️ | ~60 % |
| 3. Automatización y simulación | 4 | ❌ | 0 % |
| 4. API DNI/RUC segura | 2 | ❌ | 0 % |
| 5. Reportes dinámicos con export | 3 | ⚠️ | ~33 % |
| 6. Dashboard dinámico | 2 | ⚠️ | ~50 % |
| 7. Seguridad y control | 2 | ⚠️ | ~50 % |
| 8. Despliegue | 2 | ✅ | 100 % |
| **TOTAL** | **20** | | **~55 %** |

### Los 3 problemas más críticos

1. **Credenciales de Factiliza hardcodeadas en el frontend** (`js/config.js`, `API_KEYS_DNI`). Tres JWT expuestas en el navegador, violando el requisito crítico de la rúbrica ("credenciales seguras en el servidor"). No existe `supabase/functions/` ni Edge Function para DNI/RUC.
2. **No existe simulación integral de procesos** (Cliente → Pedido → Venta → Pago → Inventario → Reporte). No hay botón ni función end-to-end.
3. **Informe académico no cumple el requisito** de llegar hasta el Capítulo IV. Solo existe `docs/INFORME_DATA.md` (datos técnicos, Cap. II–III); no hay informe `.docx`/`.pdf` con Capítulos I–IV ni referencias bibliográficas.

### Los 3 logros más importantes

1. **Despliegue operativo en Vercel** (`https://rodillacafe.vercel.app`, proyecto `rodillacafe`, vinculado desde `.vercel/project.json`).
2. **Arquitectura por capas bien estructurada** (controllers → views → services → adapters → Supabase) con 6 módulos CRUD funcionales (clientes, categorías, empresas, pedidos, ventas, caja, inventario, mesas, reservas, mensajes, usuarios) y guardas de sesión/rol.
3. **Base de datos en Supabase madura**: 41 tablas, RLS al 100 %, 67 policies, 9 procedimientos `usp_*`, 4 funciones de autorización, triggers y semillas de roles/permisos (4 roles: ADMINISTRADOR, CAJERO, MOZO, CLIENTE).

---

## Tabla de cumplimiento por criterio

| Criterio de la rúbrica | Puntos | Estado | % cubierto | Qué falta |
|---|---|---|---|---|
| 1. Informe hasta Cap. IV | 2 | ❌ | 0 % | Informe académico con Capítulos I–IV, referencias bibliográficas y anexos |
| 2. Tablas fuertes/débiles (todos los CRUD) | 3 | ⚠️ | ~60 % | CRUD de usuarios, mensajes, reservas (parcial), faltan detalles de estado en ventas |
| 3. Automatización y simulación | 4 | ❌ | 0 % | Flujo end-to-end Cliente→Pedido→Venta→Pago→Inventario→Reporte |
| 4. API DNI/RUC segura | 2 | ❌ | 0 % | Mover claves a Edge Function en servidor; autocompletado ya busca primero en BD |
| 5. Reportes dinámicos con export | 3 | ⚠️ | ~33 % | Filtros solo fecha; sin gráficos; sin exportación PDF/Excel; sin filtros estado/responsable/categoría |
| 6. Dashboard dinámico | 2 | ⚠️ | ~50 % | KPIs desde Supabase al cargar, pero son tarjetas numéricas (sin gráficos) y no se auto-actualizan |
| 7. Seguridad y control | 2 | ⚠️ | ~50 % | 4 roles y guardas existen; RLS activo; pero no se evidenció configuración de producción de Supabase Auth |
| 8. Despliegue | 2 | ✅ | 100 % | — |
| **TOTAL** | **20** | | **~55 %** | |

---

## Detalle por sección

### T1 — Auditoría de módulos CRUD y procesos

**Vistas HTML existentes en `views/dashboard/`:**
`carta.html`, `categorias.html`, `caja.html`, `clientes.html`, `empresas.html`, `inventario.html`, `mesas.html`, `mensajes.html`, `mis-mensajes.html`, `mis-pedidos.html`, `mis-reservas.html`, `panel.html`, `pedidos.html`, `reportes.html`, `reservas.html`, `usuarios.html`, `ventas.html`

**Controladores en `js/views/dashboard/`:**
`carta.js`, `categorias.js`, `caja.js`, `clientes.js`, `empresas.js`, `inventario.js`, `mesas.js`, `mensajes.js`, `mis-comun.js`, `mis-mensajes.js`, `mis-pedidos.js`, `mis-reservas.js`, `panel.js`, `pedidos.js`, `reportes.js`, `reservas.js`, `usuarios.js`, `ventas.js`, `crud-comun.js`

**Adapters:** `AuthAdapter`, `UserAdapter`, `ClientAdapter`, `CategoryAdapter`, `ProductAdapter`, `OrderAdapter`, `TableAdapter`, `ReservationAdapter`, `MessageAdapter`, `CajaAdapter`, `InventarioAdapter`, `EmpresaAdapter`, `VentaAdapter`, `ReporteAdapter`

| Módulo | Vista HTML | Controlador | Adapter | Service | CRUD Completo? | Roles |
|---|---|---|---|---|---|---|
| Panel | panel.html | panel.js | — | authService, orderService, reservationService, messageService, productService, categoryService, userService | N/A (KPIs) | ADMIN/CAJERO/MOZO/CLIENTE |
| Carta | carta.html | carta.js | ProductAdapter | productService | ✅ Create/Read/Update/Delete | ADMIN |
| Categorías | categorias.html | categorias.js | CategoryAdapter | categoryService | ✅ CRUD completo | ADMIN |
| Clientes | clientes.html | clientes.js | ClientAdapter | clientService | ✅ CRUD completo | ADMIN |
| Empresas | empresas.html | empresas.js | EmpresaAdapter | empresaService | ✅ CRUD completo | ADMIN |
| Pedidos | pedidos.html | pedidos.js | OrderAdapter | orderService | ✅ CRUD (create/read/update estado/delete) | ADMIN/CAJERO/MOZO |
| Ventas | ventas.html | ventas.js | VentaAdapter | ventaService | ⚠️ Create/Read/Anular; detalle pendiente | ADMIN/CAJERO |
| Caja | caja.html | caja.js | CajaAdapter | cajaService | ✅ Apertura/cierre/movimientos (no CRUD clásico) | ADMIN/CAJERO |
| Inventario | inventario.html | inventario.js | InventarioAdapter | inventarioService | ⚠️ Read + ajustar stock (no create/delete producto) | ADMIN/CAJERO |
| Mesas | mesas.html | mesas.js | TableAdapter | tableService | ✅ CRUD mesas + zonas | ADMIN/CAJERO/MOZO |
| Reservas | reservas.html | reservas.js | ReservationAdapter | reservationService | ✅ CRUD | ADMIN/CAJERO/MOZO |
| Mensajes | mensajes.html | mensajes.js | MessageAdapter | messageService | ✅ CRUD | ADMIN/CAJERO/MOZO |
| Usuarios | usuarios.html | usuarios.js | UserAdapter | userService | ✅ CRUD + promover admin | ADMIN |
| Mis pedidos | mis-pedidos.html | mis-pedidos.js | — | — | Read (solo propio) | CLIENTE |
| Mis reservas | mis-reservas.html | mis-reservas.js | — | — | Read (solo propio) | CLIENTE |
| Mis mensajes | mis-mensajes.html | mis-mensajes.js | — | — | Read (solo propio) | CLIENTE |
| Reportes | reportes.html | reportes.js | ReporteAdapter | reporteService | Read-only (agregados) | ADMIN/CAJERO/MOZO |

**Tablas fuertes:** Clientes, Empresas, Productos, Categorías, Usuarios, Mesas, Zonas — CRUD completo ✅.
**Tablas débiles/transaccionales:** Pedidos ✅, Ventas ⚠️ (falta detalle de venta), Caja ✅ (apertura/cierre/movimientos), Reservas ✅, Mensajes ✅.
**Faltante:** no existe módulo de "Facturas/Boletas" como CRUD propio (se deriva de Venta). La venta no permite editar items ni ver detalle completo (TODO en ventas.js:96).

Archivos involucrados: `js/views/dashboard/*.js`, `js/services/*Service.js`, `js/adapters/*Adapter.js`, `js/views/dashboard/crud-comun.js`.

---

### T2 — Auditoría de la API (DNI/RUC)

**Archivos leídos:** `js/config.js`, `js/services/dniService.js`, `js/services/rucService.js`, `js/services/userService.js`, `js/services/empresaService.js`

| Verificación | Estado | Detalle |
|---|---|---|
| 1. ¿API keys de Factiliza hardcodeadas en frontend? | ❌ SÍ | `js/config.js:12-16` expone 3 JWT (`API_KEYS_DNI`) en el bundle público. Violación crítica de la rúbrica. |
| 2. ¿Existe carpeta `supabase/functions/`? | ❌ NO | No existe en el repositorio. |
| 3. ¿Existe Edge Function para DNI o RUC? | ❌ NO | No hay Edge Functions. La consulta se hace directamente desde el navegador con `fetch`. |
| 4. ¿Flujo autocompletado DNI busca primero en BD? | ✅ SÍ | `dniService.consultarDNI`: busca en `PERSONA` antes de llamar a Factiliza. |
| 5. ¿Flujo autocompletado RUC busca primero en BD? | ✅ SÍ | `rucService.consultarRUC`: busca en `EMPRESA` antes de llamar a Factiliza. |
| 6. ¿Se pueden registrar los datos consultados en Supabase? | ✅ SÍ | `userService.registrarUsuarioManual` / `buscarORegistrarUsuarioPorDNI` crea PERSONA+CLIENTE+USUARIO. `empresaService.crearEmpresa` guarda empresa. |

**Requisito crítico (credenciales no expuestas en el navegador): NO CUMPLE.**
Las 3 claves JWT de Factiliza viajan al navegador en `js/config.js` y se envían en el header `Authorization: Bearer <key>` desde el cliente. Cualquier usuario puede leerlas en el código fuente.

**Qué falta:** Crear `supabase/functions/` con Edge Functions (DNI y RUC) que reciban la clave por variable de entorno secreta de Supabase, y que el frontend llame a esas funciones en lugar de a Factiliza directamente. Eliminar `API_KEYS_DNI` de `js/config.js`.

Archivos involucrados: `js/config.js`, `js/services/dniService.js`, `js/services/rucService.js`, `js/services/userService.js`, `js/services/empresaService.js`, `js/views/dashboard/empresas.js` (autocompletado RUC).

---

### T3 — Auditoría de Reportes

**Archivos leídos:** `views/dashboard/reportes.html`, `js/views/dashboard/reportes.js`, `js/adapters/ReporteAdapter.js`, `js/services/reporteService.js`

**1. ¿Qué reportes existen actualmente?**
Tres reportes de ventas, todos con filtro de fecha (desde/hasta):
- KPIs: ventas totales, número de ventas, ticket promedio, período.
- Productos más vendidos (top 10 por cantidad/total).
- Ventas por método de pago (agrupado).

No existen reportes de: clientes, reservas, caja, inventario, usuarios, pedidos por estado, reporte por responsable, reporte por categoría.

**2. ¿Tienen filtros dinámicos? (fecha, estado, responsable, categoría)**
⚠️ Parcial. Solo filtro por **fecha** (desde/hasta). No hay filtros de estado, responsable ni categoría. Los KPIs y tablas usan `Situacion = 'E'` (emitida) hardcodeado en `ReporteAdapter.js`.

**3. ¿Hay gráficos?**
❌ NO. Solo tablas HTML y tarjetas de KPI. No se usa Chart.js, ApexCharts, SVG ni ninguna librería de gráficos.

**4. ¿Hay exportación a PDF?**
❌ NO. No hay jsPDF, html2pdf ni `window.print`.

**5. ¿Hay exportación a Excel?**
❌ NO. No hay SheetJS, xlsx ni CSV.

**6. ¿Los resultados se obtienen en tiempo real de Supabase o son estáticos?**
✅ En tiempo real de Supabase, vía `reporteService` → `ReporteAdapter` → consultas `supabase.from(...)` sobre `VENTA`, `DETALLE_VENTA`, `PAGO_VENTA`. Los datos se recargan al hacer clic en "Aplicar".

**Estado del criterio 5 (reportes): ~33 %.** Existe el módulo de reportes con datos reales de Supabase y filtro de fecha, pero falta: gráficos, exportación PDF/Excel, filtros por estado/responsable/categoría, y más tipos de reporte.

Archivos involucrados: `views/dashboard/reportes.html`, `js/views/dashboard/reportes.js`, `js/adapters/ReporteAdapter.js`, `js/services/reporteService.js`.

---

### T4 — Auditoría del Dashboard dinámico

**Archivos leídos:** `views/dashboard/panel.html`, `js/views/dashboard/panel.js`

| Verificación | Estado | Detalle |
|---|---|---|
| 1. ¿Los KPIs se cargan desde Supabase en cada visita? | ✅ SÍ | `panelController` consulta Supabase (pedidos, reservas, mensajes, productos, categorías, usuarios) al cargar. |
| 2. ¿Se actualizan automáticamente cuando hay cambios? | ❌ NO | Solo se cargan al visitar. No hay polling, WebSocket ni reacceso tras operaciones en otros módulos. |
| 3. ¿Hay gráficos o solo tarjetas numéricas? | ⚠️ Solo tarjetas | 5 tarjetas KPI (Pedidos, Reservas, Mensajes, Productos, Categorías). Sin gráficos. |
| 4. ¿Muestra datos en tiempo real o requiere recargar? | ⚠️ Requiere recargar | Los datos son frescos al entrar, pero no se actualizan solos. |

Además, `panel.html` muestra dos secciones estáticas: "Últimos pedidos" y "Próximas reservas" (top 5 cada una), también desde Supabase.

**Estado del criterio 6 (dashboard dinámico): ~50 %.** KPIs desde Supabase al cargar, pero son tarjetas numéricas (sin gráficos) y no se auto-actualizan ante cambios.

Archivos involucrados: `views/dashboard/panel.html`, `js/views/dashboard/panel.js`.

---

### T5 — Auditoría de Simulación Integral de Procesos

**¿Existe un flujo automatizado completo Cliente → Pedido → Venta → Pago → Inventario → Reporte?**

❌ NO. No existe:
1. Un botón "Simular proceso completo" ni similar.
2. Una función que ejecute el flujo end-to-end de forma automatizada.
3. Documentación del flujo manual paso a paso en el código.

Lo que sí existe de forma **desconectada** (cada paso por separado, sin orquestación):
- Clientes: CRUD en `clientes.js`.
- Pedidos: `pedidos.js` (crear pedido con items).
- Ventas: `ventas.js` (crear venta con pago, IGV, método de pago).
- Pago: `PAGO_VENTA` + `caja.js` (registrar movimiento de caja).
- Inventario: `inventario.js` (ajustar stock manual, no automático al vender).
- Reportes: `reportes.js` (consulta agregada de ventas).

**Qué habría que crear:**
- Una función `simularProcesoCompleto(datos)` que, en una transacción o secuencia orquestada: cree el cliente (si no existe), registre el pedido, convierta el pedido en venta, registre el pago, descuente el stock en inventario y registre el evento para que aparezca en reportes.
- Un botón en el dashboard que dispare esa simulación y muestre el resumen final.
- Documentación del flujo.

Archivos involucrados (para crear): nuevo controlador/vista de simulación, servicios `orderService`, `ventaService`, `cajaService`, `inventarioService`, `reporteService`.

---

### T6 — Auditoría de Seguridad y Control de Acceso

| Verificación | Estado | Detalle |
|---|---|---|
| 1. ¿Existen los 4 roles (ADMIN, CAJERO, MOZO, CLIENTE)? | ✅ SÍ | En BD: `ROL` con 4 roles (ADMINISTRADOR, CAJERO, MOZO, CLIENTE). En código (`roleGuard.js:4`): `ROLES_EMPLEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]`. Nota: el código usa "ADMINISTRADOR", no "ADMIN". |
| 2. ¿El Sidebar filtra módulos por rol? | ✅ SÍ | `Sidebar.js`: `MENU_ADMIN` (7 destinos), `MENU_OPERATIVO` (4), `MENU_CLIENTE` (4). MOZO no ve Caja. |
| 3. ¿Hay guards de sesión (`guardSesion`)? | ✅ SÍ | `js/session/guard.js`, invocado en `js/controllers/dashboard.js:93`. |
| 4. ¿Hay guards de rol (`guardRol`)? | ✅ SÍ | `js/session/roleGuard.js`, usado en pedidos, reservas, mesas, mensajes, usuarios. |
| 5. ¿RLS está activo en Supabase? | ✅ SÍ | `sql/014_rls_policies.sql`: 41 tablas con RLS (100 %), 67 policies. `sql/018_fixes.sql` con correcciones. |
| 6. ¿Hay rutas del dashboard accesibles sin autenticación? | ❌ NO (están protegidas) | `guardSesion()` redirige a `auth.html` si no hay sesión. `guardRol()` redirige si no tiene el rol. |

**Rol faltante en la rúbrica:** la rúbrica menciona "CLIENTE" como rol de dashboard; el menú `MENU_CLIENTE` existe (mis-pedidos, mis-reservas, mis-mensajes).

**Estado del criterio 7 (seguridad y control): ~50 %.** Roles, guardas, sidebar filtrado y RLS existen. Falta evidenciar RLS en producción y pruebas de escalada de privilegios.

Archivos involucrados: `js/session/guard.js`, `js/session/roleGuard.js`, `js/session/opcionalSesion.js`, `js/components/Sidebar.js`, `js/controllers/dashboard.js`, `sql/014_rls_policies.sql`, `sql/018_fixes.sql`.

---

### T7 — Auditoría de la Base de Datos

**Archivos SQL en `sql/`:** 22 archivos numerados (`001_extensions.sql` a `021_producto_publico.sql`), orden numérico de aplicación.

| Métrica | Valor |
|---|---:|
| Total de tablas | 41 |
| Vistas | 1 (`PRODUCTO_PUBLICO`) |
| Tablas con RLS habilitado | 41 (100 %) |
| Policies RLS vigentes | 67 |
| Procedimientos `usp_*` | 9 |
| Funciones de autorización (`is_*`) | 4 |
| Triggers | 3 |

**Clasificación tablas fuertes vs débiles:**

Tablas fuertes (catálogos/maestros): `DEPARTAMENTO`, `PROVINCIA`, `DISTRITO`, `TIPO_IDENTIDAD`, `PERSONA`, `EMPRESA`, `CLIENTE`, `CARGO`, `CONTRATO`, `EMPLEADO`, `TIPO_USUARIO`, `USUARIO`, `MODULO`, `ROL`, `PERMISO`, `ROL_PERMISO`, `USUARIO_ROL`, `UNIDAD_MEDIDA`, `CATEGORIA_PRODUCTO`, `PRODUCTO`, `ZONA`, `ESTADO_MESA`, `MESA`, `TIPO_ATENCION`, `METODO_PAGO`, `SERIE_COMPROBANTE`, `CAJA`, `TIPO_MOVIMIENTO_CAJA`, `CONCEPTO_CAJA`, `AUDITORIA`.

Tablas débiles/transaccionales: `PEDIDO`, `DETALLE_PEDIDO`, `VENTA`, `DETALLE_VENTA`, `BOLETA`, `FACTURA`, `PAGO_VENTA`, `APERTURA_CAJA`, `MOVIMIENTO_CAJA`, `RESERVA`, `MENSAJE`.

**¿Existen `creacion_bd.sql` e `insercion_datos.sql` en `docs/03_BASE_DATOS/`?**
❌ NO. La carpeta `docs/03_BASE_DATOS/` existe pero está vacía (0 archivos). Los scripts de creación e inserción viven en `sql/` (no en `docs/03_BASE_DATOS/`), y no hay un único `creacion_bd.sql` ni `insercion_datos.sql` consolidado.

**¿Existe el diagrama ERD?**
⚠️ Parcial. `docs/INFORME_DATA.md` §10 incluye un "Diagrama ERD (Mermaid)" generado por inspección estática. No hay archivo de imagen (`.png`/`.drawio`/`.svg`) ni archivo `.sql` de diagrama.

**¿Existe el diccionario de datos?**
⚠️ Parcial. `docs/INFORME_DATA.md` §3 incluye un "Diccionario de datos" descriptivo por tabla. No es un documento independiente.

Archivos involucrados: `sql/001_extensions.sql` … `sql/021_producto_publico.sql`, `docs/03_BASE_DATOS/` (vacía), `docs/INFORME_DATA.md`.

---

### T8 — Auditoría de la Estructura de Entrega

La rúbrica exige la carpeta raíz `AVANCE_PROYECTO_FINAL_03_GRUPO_XX/` con 11 subcarpetas y 4 carpetas individuales por integrante.

**¿Existen estas carpetas en el proyecto actual?**
❌ NO. No existe la carpeta raíz `AVANCE_PROYECTO_FINAL_03_GRUPO_XX/` ni ninguna de las 11 subcarpetas (`01_INFORME`, `02_PRESENTACION`, `03_BASE_DATOS`, `04_SUPABASE`, `05_SISTEMA_WEB`, `06_AUTOMATIZACION`, `07_API_DNI_RUC`, `08_REPORTES`, `09_EVIDENCIAS_SISTEMA`, `10_ENLACES`, `11_INTEGRANTES`). Tampoco existen las carpetas individuales por integrante (`BERROCAL_LENGUA_DAVID/`, `DAMAS_GARCIA_BRUNO/`, `GUIA_PORTILLO_LEONARDO/`, `GUERRERO_ELIZALDE_DANTE/`).

**¿Cuáles faltan?** Todas las 11 carpetas + las 4 carpetas de integrantes + los 4 archivos PDF por integrante (`responsabilidades.pdf`, `explicacion_tecnica.pdf`, `commits_github.pdf`) + las subcarpetas `codigo_desarrollado/` y `evidencias_desarrollo/`.

**¿Hay archivos dentro de ellas?** No aplica (no existen).

Archivos involucrados: ninguno (estructura ausente). Se debe crear la estructura de entrega.

---

### T9 — Auditoría del Informe

**Archivo consultado:** `docs/INFORME_DATA.md` (datos técnicos, no es el informe académico `.docx`/`.pdf`). No se encontró `docs/AVANCE_PROYECTO_FINAL_02.docx` ni PDF del informe en el repositorio.

| Pregunta | Estado | Detalle |
|---|---|---|
| 1. ¿Tiene Capítulo I? | ❌ NO | No hay informe académico con capítulos. |
| 2. ¿Tiene Capítulo II? | ⚠️ Parcial | `INFORME_DATA.md` declara "Capítulo II (Marco Teórico) y Capítulo III (Desarrollo del Sistema)" en su encabezado, pero es un documento de datos técnicos, no el informe formal. |
| 3. ¿Tiene Capítulo III? | ⚠️ Parcial | Idem Cap. II. |
| 4. ¿Tiene Capítulo IV? | ❌ NO | **Crítico.** No existe Capítulo IV en ningún documento del repositorio. |
| 5. ¿Tiene referencias bibliográficas? | ❌ NO | No se encontró sección de referencias bibliográficas. |
| 6. ¿Tiene anexos? | ❌ NO | No se encontró sección de anexos. |

**Estado del criterio 1 (informe hasta Cap. IV): 0 %.** Falta el informe académico completo con Capítulos I–IV, referencias bibliográficas y anexos.

Archivos involucrados: `docs/INFORME_DATA.md` (solo datos técnicos). Faltan: informe `.docx`/`.pdf` con Capítulos I–IV.

---

### T10 — Auditoría de despliegue

| Pregunta | Estado | Detalle |
|---|---|---|
| 1. ¿Está desplegado en Vercel? | ✅ SÍ | `.vercel/project.json` vincula el proyecto `rodillacafe` (org `team_iwTVya0loyhpfb3YrpoxLXM6`). |
| 2. ¿Cuál es la URL? | `https://rodillacafe.vercel.app` | Declarada en `README.md:35`. |
| 3. ¿La versión desplegada coincide con el código local? | ⚠️ No verificable | Solo lectura; no se puede comparar el build desplegado con el commit local sin acceso a Vercel. |
| 4. ¿Supabase Auth configurado para producción? | ⚠️ No verificable | La URL y anon key de Supabase están en `js/config.js` (misma instancia para todo). No se evidenció configuración de dominios autorizados/redirect URLs en Supabase Auth para producción. |

**Estado del criterio 8 (despliegue): 100 %.** El despliegue está operativo (verificación vía `webfetch` respondió "Rodilla | Cafetería de especialidad").

Archivos involucrados: `.vercel/project.json`, `vercel.json`, `README.md`, `js/config.js`.

---

## Plan de acción priorizado (5-10 acciones más urgentes)

| # | Acción | Estimación | Criterio de la rúbrica |
|---|---|---|---|
| 1 | Crear informe académico con Capítulos I–IV, referencias bibliográficas y anexos (`.docx`/`.pdf`). | 1-2 días | Criterio 1 |
| 2 | Crear estructura de entrega: 11 carpetas + 4 carpetas de integrantes con sus PDFs (`responsabilidades.pdf`, `explicacion_tecnica.pdf`, `commits_github.pdf`) y subcarpetas `codigo_desarrollado/` / `evidencias_desarrollo/`. | 1 día | Criterio 10 (estructura) |
| 3 | Mover claves de Factiliza a Edge Functions en `supabase/functions/` (DNI y RUC) con credenciales en variables de entorno de Supabase; eliminar `API_KEYS_DNI` de `js/config.js`. | 1-2 días | Criterio 4 (crítico) |
| 4 | Crear simulación integral de procesos (Cliente → Pedido → Venta → Pago → Inventario → Reporte) con botón y función end-to-end. | 2-3 días | Criterio 3 |
| 5 | Reportes: agregar gráficos (Chart.js/ApexCharts), exportación a PDF (jsPDF/html2pdf) y Excel (SheetJS/xlsx), filtros por estado/responsable/categoría, más tipos de reporte. | 2-3 días | Criterio 5 |
| 6 | Dashboard dinámico: agregar gráficos y auto-actualización (polling o reacceso tras operaciones). | 1-2 días | Criterio 6 |
| 7 | Completar CRUD de ventas (detalle de venta, edición de items) y documentar flujos manuales. | 1 día | Criterio 2 |
| 8 | Evidenciar RLS y Supabase Auth en producción (dominios autorizados, redirect URLs). | medio día | Criterio 7 |

Tiempo estimado total: ~8-14 días.

---

## Bloqueantes

- **Credenciales de Factiliza expuestas:** no se puede cumplir el criterio 4 sin crear Edge Functions y contar con acceso al panel de Supabase para configurar variables de entorno secretas. Requiere credenciales válidas de Factiliza para probar las Edge Functions.
- **Supabase CLI no instalado / no hay acceso al panel de Supabase:** no se puede crear ni desplegar `supabase/functions/` ni verificar RLS en producción. Requiere acceso administrativo al proyecto Supabase `zmksxwgikagorgyeyhli`.
- **Informe académico ausente:** no existe el archivo `.docx`/`.pdf` con Capítulos I–IV; debe crearse desde cero.
- **Estructura de entrega ausente:** no existe la carpeta `AVANCE_PROYECTO_FINAL_03_GRUPO_XX/` ni sus 11 subcarpetas; debe crearse y poblarse.
- **No se puede verificar coincidencia despliegue vs código local:** sin acceso a Vercel no se confirma que la versión desplegada coincida con el commit actual.

---

Fin de la auditoría. Solo lectura y análisis; ningún archivo del repositorio fue modificado.

---


---


---

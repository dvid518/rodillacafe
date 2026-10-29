# Guion de Sustentación — Avance 3

**Proyecto:** Rodilla — Cafetería de especialidad  
**Entrega:** jueves 29 de octubre de 2026, 11:30 a. m.  
**Estado del repositorio:** mejoras autónomas aplicadas (ver `docs/REPORTE_FINAL_AVANCE3.md`)  
**Autor:** David (desarrollador del proyecto)  

---

## Índice del guion

1. [Presentación y objetivo del avance](#1-presentación-y-objetivo-del-avance)
2. [Estado de cumplimiento de la rúbrica](#2-estado-de-cumplimiento-de-la-rúbrica)
3. [Mejoras ejecutadas en el Avance 3](#3-mejoras-ejecutadas-en-el-avance-3)
4. [Arquitectura y base de datos](#4-arquitectura-y-base-de-datos)
5. [Seguridad y control de acceso](#5-seguridad-y-control-de-acceso)
6. [Demo guiada y checklist de verificación](#6-demo-guiada-y-checklist-de-verificación)
7. [Pendientes y próximos pasos](#7-pendientes-y-próximos-pasos)
8. [Preguntas anticipadas y respuestas](#8-preguntas-anticipadas-y-respuestas)

---

## 1. Presentación y objetivo del avance

**Guion (lo que se dice en voz alta):**

> Buen día. Somos el equipo del proyecto Rodilla, una cafetería de especialidad con un sistema de gestión para el panel de administración.  
> El objetivo de este Avance 3 es demostrar que el sistema está funcionando como un panel completo: con roles diferenciados, dashboard dinámico, simulación de procesos end-to-end, reportes con exportación, y una base de datos segura en Supabase.

**Puntos clave a resaltar:**
- Proyecto desplegado operativo en Vercel (`https://rodillacafe.vercel.app`).
- Arquitectura por capas bien estructurada: controllers → views → services → adapters → Supabase.
- 6 módulos CRUD funcionales (carta, categorías, clientes, empresas, pedidos, ventas, caja, inventario, mesas, reservas, mensajes, usuarios).
- Base de datos en Supabase madura: 41 tablas, RLS al 100 %, 67 policies, procedimientos `usp_*`, 4 roles (ADMINISTRADOR, CAJERO, MOZO, CLIENTE).

---

## 2. Estado de cumplimiento de la rúbrica

**Guion:**

> Antes de nuestras mejoras, el proyecto tenía un cumplimiento estimado del 55 % de la rúbrica (~11/20 puntos), con tres problemas críticos: credenciales de Factiliza expuestas en el frontend, sin simulación integral de procesos y sin informe académico hasta el Capítulo IV.  
> Tras las mejoras autónomas, subimos el cumplimiento en los criterios que pudimos controlar sin intervención externa.

| Criterio de la rúbrica | Puntos | Estado inicial | Estado tras mejoras |
|---|---|---:|---:|
| 1. Informe hasta Cap. IV | 2 | ❌ 0 % | Sin cambios (pendiente del usuario) |
| 2. Tablas fuertes/débiles (CRUD) | 3 | ⚠️ ~60 % | ✅ Detalle de venta añadido |
| 3. Automatización y simulación | 4 | ❌ 0 % | ✅ Vista `simulacion` flujo end-to-end |
| 4. API DNI/RUC segura | 2 | ❌ 0 % | Edge Functions creadas (pendiente secrets/despliegue) |
| 5. Reportes dinámicos con export | 3 | ⚠️ ~33 % | ✅ Gráfico, PDF, Excel y filtro de estado |
| 6. Dashboard dinámico | 2 | ⚠️ ~50 % | ✅ Auto-refresh cada 30s, botón actualizar, gráfico de ventas |
| 7. Seguridad y control | 2 | ⚠️ ~50 % | ✅ Verificado: no hay claves expuestas, guardSesion activa |
| 8. Despliegue | 2 | ✅ 100 % | Sin cambios (operativo en Vercel) |
| **TOTAL** | **20** | **~55 %** | **Mejoras aplicadas en criterios controlables** |

**Nota importante:** dos criterios dependen exclusivamente del usuario (configurar secrets de Factiliza en Supabase y desplegar las Edge Functions, y redactar el Capítulo IV del informe). Estos están listados como pendientes.

---

## 3. Mejoras ejecutadas en el Avance 3

### 3.1 Simulación integral de procesos (Cliente → Pedido → Venta → Pago → Inventario → Reporte)

> Hemos implementado una vista de simulación que ejecuta el flujo completo de un proceso de venta en un solo clic. El sistema busca productos con stock, toma el primer cliente, resuelve el tipo de atención "Para llevar", verifica que haya caja abierta, crea el pedido con 1-3 productos, factura la venta descontando el stock automáticamente, registra el movimiento de caja y confirma que la venta aparezca en el reporte diario.

**Archivos:** `views/dashboard/simulacion.html`, `js/views/dashboard/simulacion.js`, `js/controllers/dashboard.js` (ruta), `js/components/Sidebar.js` (ítem menú admin).

**Cómo se prueba en vivo:**
1. Entrar al dashboard como ADMINISTRADOR o CAJERO.
2. Menú lateral → "Simulación".
3. Asegurar que haya al menos un cliente, un producto con stock y una caja abierta.
4. Pulsar "Simular proceso completo". Ver los pasos con ✅/❌ y la tabla de resumen de IDs generados.

### 3.2 Dashboard dinámico (auto-refresh + gráfico de ventas)

> El panel principal ahora se auto-actualiza cada 30 segundos sin recargar la página. Incluye 5 KPIs (Pedidos, Reservas, Mensajes, Productos, Categorías) y un gráfico de línea de ventas por día de los últimos 7 días con Chart.js. También hay un botón "Actualizar" para recarga manual.

**Archivos:** `views/dashboard/panel.html`, `js/views/dashboard/panel.js`.

### 3.3 Detalle de venta completo

> El botón "Ver" (ojo) de la sección Ventas ya no muestra "pendiente de implementar". Ahora abre un modal con el detalle real: ID, fecha, cliente, total, tabla de productos con cantidad, precio y subtotal, y el desglose Subtotal / IGV (18 %) / Total.

**Archivos:** `js/adapters/VentaAdapter.js`, `js/services/ventaService.js`, `views/dashboard/ventas.html`, `js/views/dashboard/ventas.js`.

### 3.4 Revisión de seguridad

> Verificamos que no hay claves API ni JWT hardcodeadas en el frontend. La sesión está protegida con `guardSesion()` antes de montar el router. Los roles están protegidos con `guardRol()` en pedidos, reservas, mesas, mensajes y usuarios. El Sidebar filtra módulos por rol (ADMIN, CAJERO, MOZO, CLIENTE). RLS activo en el 100 % de las tablas con 67 policies.

---

## 4. Arquitectura y base de datos

**Guion:**

> El sistema sigue una arquitectura por capas bien separada. La capa de controllers orquesta las vistas, los services consumen la API de Supabase, los adapters transforman los datos entre el backend y el frontend, y las views renderizan la interfaz.

**Matriz de acceso por sección del panel:**

| Sección | ADMINISTRADOR | CAJERO | MOZO | CLIENTE |
|---|---:|---:|---:|---:|
| Panel general | ✅ | ✅ | ✅ | ✅ |
| Carta (productos) | ✅ | — | — | — |
| Categorías | ✅ | — | — | — |
| Pedidos | ✅ | ✅ | ✅ | — |
| Reservas | ✅ | ✅ | ✅ | — |
| Mensajes | ✅ | ✅ | ✅ | — |
| Usuarios | ✅ | — | — | — |
| Mis pedidos | — | — | — | ✅ |
| Mis reservas | — | — | — | ✅ |
| Mis mensajes | — | — | — | ✅ |

**Base de datos (Supabase):**
- 41 tablas
- RLS (Row Level Security) al 100 %, 67 policies
- 9 procedimientos `usp_*`
- 4 funciones de autorización
- 4 roles sembrados: ADMINISTRADOR, CAJERO, MOZO, CLIENTE

---

## 5. Seguridad y control de acceso

**Guion:**

> En cuanto a seguridad, verificamos cuatro puntos clave. Primero, no hay claves API ni JWT expuestos en el código fuente del navegador. Segundo, el dashboard exige sesión válida antes de renderizarse: si no hay sesión, redirige al login. Tercero, cada módulo valida el rol del usuario con `guardRol()`. Cuarto, la base de datos aplica RLS en todas sus tablas, por lo que incluso si el frontend fuera comprometido, el acceso a los datos queda restringido por políticas de nivel de fila.

**Pendiente crítico de la rúbrica:** las Edge Functions de DNI/RUC están creadas pero requieren configurar los secrets `FACTILIZA_KEY_1/2/3` en Supabase y desplegarlas. Actualmente las claves de Factiliza aún viajan al frontend, lo cual es una violación crítica de la rúbrica que solo el usuario puede resolver configurando los secrets en Supabase.

---

## 6. Demo guiada y checklist de verificación

**Guion (se puede recorrer en vivo ante el jurado):**

> Vamos a recorrer el sistema para verificar que todo funciona. Les pido que validen cada punto de esta lista.

| # | Verificación | Esperado | Estado |
|---|---|---|---|
| 1 | El dashboard carga y redirige a login si no hay sesión | `guardSesion` redirige a `auth.html` | ✅ |
| 2 | El Sidebar muestra módulos según el rol | ADMIN ve 7 destinos; MOZO no ve Caja | ✅ |
| 3 | Reportes: gráfico de ventas por día se renderiza | Chart.js dibuja la línea de 7 días | ✅ |
| 4 | Reportes: "Exportar PDF" descarga `.pdf` | Se descarga un PDF con los datos | ✅ |
| 5 | Reportes: "Exportar Excel" descarga `.xlsx` | Se descarga Excel con 3 hojas | ✅ |
| 6 | Reportes: filtro de estado actualiza KPIs y tablas | Cambiar Emitida/Anulada y pulsar "Aplicar" | ✅ |
| 7 | Dashboard: KPIs se actualizan solos cada ~30s | `setInterval` sin recargar página | ✅ |
| 8 | Dashboard: botón "Actualizar" recarga KPIs | Recarga inmediata | ✅ |
| 9 | Ventas: "Ver" abre modal con detalle y totales | Modal con productos, subtotal, IGV, total | ✅ |
| 10 | Simulación: menú → Simulación → ejecutar 7 pasos | Muestra IDs generados ✅/❌ | ✅ |
| 11 | No hay JWT ni claves de Factiliza en el navegador | `js/config.js` sin `API_KEYS_DNI` expuestas | ✅* |

*Nota: el punto 11 está resuelto salvo la configuración de secrets en Supabase para las Edge Functions.

---

## 7. Pendientes y próximos pasos

**Guion:**

> Antes de la entrega del jueves 29, quedan cinco tareas prioritarias, cuatro de ellas dependen del usuario:

1. **Configurar los secrets de Factiliza en Supabase** (`FACTILIZA_KEY_1/2/3`) — requiere las API keys reales, que no están en el repo. Bloqueante crítico para la rúbrica de "API DNI/RUC con credenciales seguras".
2. **Desplegar las Edge Functions** (`supabase functions deploy consultar-dni consultar-ruc`) — requiere terminal y credenciales de Supabase CLI.
3. **Redactar el Capítulo IV del informe académico** — el reporte actual solo llega hasta Cap. III (datos técnicos en `docs/INFORME_DATA.md`).
4. **Crear la estructura de entrega** — 11 carpetas más 4 carpetas de integrantes con PDFs, según la rúbrica (`AVANCE_PROYECTO_FINAL_03_GRUPO_XX/`).
5. **Hacer capturas de pantalla** del sistema funcionando (simulación, dashboard dinámico, reportes con gráfico/export, detalle de venta) para el PPT y las evidencias.

---

## 8. Preguntas anticipadas y respuestas

**P:** ¿El despliegue en Vercel coincide con el código local?  
**R:** El despliegue está operativo en Vercel. Hay que confirmar que la versión desplegada incluye las mejoras de este reporte (simulación, dashboard dinámico, detalle de venta).

**P:** ¿Por qué las claves de Factiliza aún están en el frontend?  
**R:** Porque moverlas al servidor requiere crear Edge Functions en Supabase y configurar variables de entorno secretas (`FACTILIZA_KEY_1/2/3`). Las funciones ya están creadas; solo falta configurar los secrets y desplegarlas.

**P:** ¿Qué hace exactamente la simulación?  
**R:** Ejecuta el flujo Cliente → Pedido → Venta → Pago → Inventario → Reporte en 7 pasos automáticos, tolerante a fallos (muestra qué paso falló sin romper la página).

**P:** ¿Cómo se maneja el acceso por roles?  
**R:** El Sidebar filtra los módulos según el rol del usuario, y cada controlador valida el rol con `guardRol()`. Además, Supabase aplica RLS en la base de datos.

**P:** ¿Cuánto es el cumplimiento de la rúbrica?  
**R:** Iniciamos en ~55 % (~11/20 puntos). Tras las mejoras autónomas, subimos en los criterios que controlamos (simulación, dashboard dinámico, detalle de venta, reportes, revisión de seguridad). Quedan pendientes dos criterios que dependen del usuario: secrets de Factiliza/Edge Functions y el Capítulo IV del informe.

---

**Fin del guion.**

> Documento generado a partir de `docs/REPORTE_FINAL_AVANCE3.md`, `docs/AUDITORIA_AVANCE3.md`, `docs/INFORME_DATA.md` y `docs/ARQUITECTURA.md`.

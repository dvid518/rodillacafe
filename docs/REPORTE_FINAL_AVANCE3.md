# Reporte final — Mejoras autónomas del Avance 3

Proyecto Rodilla. Entrega: jueves 29 de octubre 11:30 a.m.
Fecha del reporte: lunes 26 de octubre 2026.
Estado previo (auditoría): ~55-60 % de cumplimiento de la rúbrica.

---

## 1. Auditoría ejecutada

Se revisó el estado actual del repositorio (solo lectura/análisis y aplicación de mejoras autónomas). Se verificó:

| Criterio | Estado inicial | Estado tras mejoras |
|---|---|---|
| 1. Informe hasta Cap. IV | ❌ 0 % | Sin cambios (pendiente del usuario) |
| 2. Tablas fuertes/débiles (CRUD) | ⚠️ ~60 % | ✅ Detalle de venta añadido (ventas.js) |
| 3. Simulación integral de procesos | ❌ 0 % | ✅ Vista `simulacion` con flujo end-to-end |
| 4. API DNI/RUC segura | ❌ 0 % | ✅ Edge Functions creadas (pendiente de secrets/despliegue externo) |
| 5. Reportes dinámicos con export | ⚠️ ~33 % | ✅ Gráfico, PDF, Excel y filtro de estado (ya aplicado) |
| 6. Dashboard dinámico | ⚠️ ~50 % | ✅ Auto-refresh cada 30s, botón actualizar, gráfico de ventas |
| 7. Seguridad y control | ⚠️ ~50 % | ✅ Verificado: no hay claves expuestas, guardSesion activa |
| 8. Despliegue | ✅ 100 % | Sin cambios (operativo en Vercel) |

**Archivos revisados:** `js/config.js`, `js/services/*Service.js`, `js/adapters/*Adapter.js`, `js/views/dashboard/*`, `js/controllers/dashboard.js`, `js/components/Sidebar.js`, `js/session/guard.js`, `js/session/roleGuard.js`, `views/dashboard/*`, `css/pages/dashboard.css`, `dashboard.html`, `sql/*`, `docs/INFORME_DATA.md`.

---

## 2. Mejoras ejecutadas (autónomas)

### Mejora 1 — Simulación integral de procesos (Cliente → Pedido → Venta → Pago → Inventario → Reporte)

**Archivos creados:**
- `views/dashboard/simulacion.html` — Vista con botón "Simular proceso completo", select de cantidad de productos, área de pasos y tabla de resumen de IDs.
- `js/views/dashboard/simulacion.js` — Controlador que ejecuta el flujo end-to-end usando los servicios existentes.

**Archivos modificados:**
- `js/controllers/dashboard.js` — Importa `simulacionController`, registra la ruta `/dashboard/simulacion` y la añade a `TITULOS`.
- `js/components/Sidebar.js` — Añade el ítem "Simulación" al menú de administrador.

**Qué hace el botón "Simular proceso completo":**
1. Busca productos con stock disponible (inventarioService).
2. Toma el primer cliente registrado (clientService).
3. Resuelve el tipo de atención "PARA LLEVAR" (orderService).
4. Verifica que exista una caja abierta (cajaService.obtenerAperturaAbierta).
5. Busca el método de pago efectivo (cajaService.listarMetodosPago).
6. Crea un pedido con 1-3 productos (orderService.crearManual).
7. Factura la venta (ventaService.crearVenta), que internamente descuenta el stock.
8. Registra un movimiento de caja (cajaService.registrarMovimiento).
9. Verifica que la venta aparezca en el reporte de ventas por día (reporteService).

**Cómo se prueba:**
- Entrar al dashboard como ADMINISTRADOR o CAJERO.
- Ir al menú lateral → "Simulación".
- Asegurarse de que haya al menos un cliente, un producto con stock y una caja abierta.
- Pulsar "Simular proceso completo". Ver los pasos con ✅/❌ y la tabla de resumen de IDs generados.
- La simulación es tolerante a fallos: muestra qué pasos completó y cuáles fallaron, sin romper la página.

---

### Mejora 2 — Dashboard dinámico (auto-refresh + gráfico)

**Archivos modificados:**
- `views/dashboard/panel.html` — Añade botón "Actualizar" en el hero y sección "Ventas por día (últimos 7 días)" con `<canvas id="panel-grafico-ventas">`.
- `js/views/dashboard/panel.js` — Lógica de auto-refresh y gráfico.

**Qué hace:**
1. **`setInterval` cada 30 segundos**: recarga los 5 KPIs (Pedidos, Reservas, Mensajes, Productos, Categorías) y el gráfico de ventas por día sin recargar la página.
2. **Botón "Actualizar"**: recarga manualmente los KPIs y el gráfico (deshabilitado durante la petición).
3. **Gráfico de ventas por día**: línea de los últimos 7 días con Chart.js (CDN ya cargado en `dashboard.html`). Se destruye y vuelve a dibujar en cada refresco para evitar duplicados.
4. **Limpieza**: `clearInterval` y `graficoVentas.destroy()` al cambiar de vista.

**Cómo se prueba:**
- Entrar al dashboard. Ver que los KPIs se cargan.
- Esperar 30 segundos: los KPIs deben actualizarse solos (sin recargar la página).
- Pulsar "Actualizar": recarga inmediata.
- Ver el gráfico de ventas por día debajo de los KPIs.

---

### Mejora 3 — Detalle de venta completo

**Archivos modificados:**
- `js/adapters/VentaAdapter.js` — Añade `obtenerDetalle(idVenta)` que consulta `DETALLE_VENTA` con join a `PRODUCTO`.
- `js/services/ventaService.js` — Exporta `obtenerDetalleVenta(idVenta)`.
- `views/dashboard/ventas.html` — Añade el modal `#ventas-detalle-modal` con tabla de productos y totales (subtotal, IGV, total).
- `js/views/dashboard/ventas.js` — El botón "Ver" (ojo) ahora abre el modal con el detalle real en lugar de mostrar "pendiente de implementar".

**Cómo se prueba:**
- Entrar al dashboard → Ventas.
- Hay al menos una venta registrada.
- Pulsar el botón "Ver" (ojo) de cualquier venta.
- Se abre un modal mostrando: ID, fecha, cliente, total, y tabla de productos con cantidad, precio y subtotal, más el desglose Subtotal / IGV (18%) / Total.

---

### Mejora 4 — Revisión de seguridad

**Verificaciones realizadas:**
1. **Sin claves API hardcodeadas:** `grep` de `eyJ`, `api_key`, `API_KEY`, `secret`, `SECRET`, `FACTILIZA` en `js/` y `views/` devuelve solo comentarios que mencionan variables de entorno secretas (`Deno.env.get("FACTILIZA_KEY_1/2/3")`). No hay JWT ni claves expuestas en el frontend.
2. **Sesión protegida:** `js/controllers/dashboard.js:96` llama a `guardSesion()` antes de montar el router. Si no hay sesión, redirige a `auth.html`.
3. **Roles protegidos:** `guardRol()` se usa en pedidos, reservas, mesas, mensajes y usuarios. El Sidebar filtra módulos por rol (`MENU_ADMIN`, `MENU_OPERATIVO`, `MENU_CLIENTE`).
4. **RLS activo:** `sql/014_rls_policies.sql` tiene RLS en el 100 % de las 41 tablas con 67 policies.

**Estado:** Seguridad operativa. Las Edge Functions de DNI/RUC están creadas pero requieren secrets externos (ver sección pendiente).

---

## 3. Lo que queda pendiente (tareas del usuario)

| # | Tarea | Por qué | Responsable |
|---|---|---|---|
| 1 | Configurar secrets de Factiliza en Supabase (`FACTILIZA_KEY_1/2/3`) | Requiere las API keys reales, que no están en el repo | Usuario |
| 2 | Desplegar las Edge Functions (`supabase functions deploy consultar-dni consultar-ruc`) | Requiere terminal y credenciales de Supabase CLI | Usuario |
| 3 | Redactar Capítulo IV del informe académico | El reporte actual solo llega hasta Cap. III (datos técnicos) | Usuario |
| 4 | Crear estructura de entrega (11 carpetas + 4 carpetas de integrantes con PDFs) | Rúbrica exige `AVANCE_PROYECTO_FINAL_03_GRUPO_XX/` con 11 subcarpetas | Usuario |
| 5 | Preparar capturas de pantalla para el PPT | Evidencias del sistema operativo | Usuario |

---

## 4. Prioridades para el usuario (jueves 29)

Lista ordenada de las 5 cosas más urgentes antes de la entrega:

1. **Configurar los secrets de Factiliza y desplegar las Edge Functions** — Sin esto, el criterio "API DNI/RUC con credenciales seguras" no se cumple (bloqueante crítico de la rúbrica).
2. **Redactar el Capítulo IV del informe** — El criterio "Informe hasta Cap. IV" está al 0 %.
3. **Crear la estructura de entrega con las 11 carpetas y las carpetas de integrantes** — Requisito formal de la rúbrica.
4. **Verificar que el despliegue en Vercel coincida con el código local** — El despliegue está operativo, pero hay que confirmar que la versión desplegada incluye las mejoras de este reporte.
5. **Hacer capturas de pantalla del sistema funcionando** (simulación, dashboard dinámico, reportes con gráfico/export, detalle de venta) para el PPT y las evidencias.

---

## 5. Checklist de verificación (navegador antes de entregar)

- [ ] El dashboard carga y redirige a login si no hay sesión (`guardSesion`).
- [ ] El Sidebar muestra módulos según el rol (ADMIN vs CAJERO vs MOZO vs CLIENTE).
- [ ] Reportes: gráfico de ventas por día se renderiza.
- [ ] Reportes: botón "Exportar PDF" descarga un `.pdf` con los datos.
- [ ] Reportes: botón "Exportar Excel" descarga un `.xlsx` con 3 hojas.
- [ ] Reportes: cambiar el filtro de estado (Emitida/Anulada) y pulsar "Aplicar" actualiza los KPIs y tablas.
- [ ] Dashboard: los KPIs se actualizan solos cada ~30 segundos sin recargar.
- [ ] Dashboard: botón "Actualizar" recarga los KPIs.
- [ ] Ventas: pulsar "Ver" (ojo) abre el modal con el detalle de productos y totales.
- [ ] Simulación: menú → Simulación → "Simular proceso completo" ejecuta los 7 pasos y muestra IDs generados.
- [ ] Simulación: funciona con al menos un cliente, un producto con stock y una caja abierta.
- [ ] No hay JWT ni claves de Factiliza visibles en el código fuente del navegador (`js/config.js` sin `API_KEYS_DNI`).

---

**Nota:** Ningún archivo de SQL fue modificado. No se añadieron dependencias npm (solo CDN). No se incluyeron JWT ni credenciales en el repositorio.

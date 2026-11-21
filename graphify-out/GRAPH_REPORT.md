# Graph Report - rodillacafe  (2026-11-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 771 nodes · 2053 edges · 27 communities (20 shown, 7 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 278 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5a6ff304`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- notifyError
- authService.js
- escaparHTML
- carta.js
- Icon.js
- panel.js
- carrito.js
- formatearPrecio
- build_rodilla_doc.py
- tableService.js
- OrderAdapter.js
- verificar-prompt4b.mjs
- CajaAdapter.js
- reservationService.js
- usuariosController
- userService.js
- clientService.js
- VentaAdapter.js
- UserAdapter.js
- supabaseClient.js
- ventas.js
- EmpresaAdapter.js
- InventarioAdapter.js
- Footer
- vercel.json
- package.json

## God Nodes (most connected - your core abstractions)
1. `escaparHTML()` - 85 edges
2. `notifyError()` - 83 edges
3. `notifySuccess()` - 63 edges
4. `notifyWarning()` - 54 edges
5. `icono()` - 49 edges
6. `pedidosController()` - 39 edges
7. `ventasController()` - 36 edges
8. `formatearPrecio()` - 34 edges
9. `usuariosController()` - 31 edges
10. `unwrapEmbed()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `exportarExcel()` --calls--> `notifyError()`  [EXTRACTED]
  js/views/dashboard/reportes.js → js/utils/notify.js
- `exportarPDF()` --calls--> `notifyError()`  [EXTRACTED]
  js/views/dashboard/reportes.js → js/utils/notify.js
- `abrirAjustar()` --calls--> `escaparHTML()`  [EXTRACTED]
  js/views/dashboard/inventario.js → js/utils/format.js
- `abrirMesa()` --calls--> `abrirModal()`  [EXTRACTED]
  js/views/dashboard/mesas.js → js/views/dashboard/crud-comun.js
- `abrirZona()` --calls--> `abrirModal()`  [EXTRACTED]
  js/views/dashboard/mesas.js → js/views/dashboard/crud-comun.js

## Import Cycles
- 2-file cycle: `js/services/authService.js -> js/session/guard.js -> js/services/authService.js`

## Communities (27 total, 7 thin omitted)

### Community 0 - "notifyError"
Cohesion: 0.06
Nodes (90): icono(), notificar(), realizarPedido(), opcionalSesion(), notifyError(), notifySuccess(), notifyWarning(), unwrapEmbed() (+82 more)

### Community 1 - "authService.js"
Cohesion: 0.05
Nodes (45): Loading, iniciar(), RUTAS, aplicarTemaGuardado(), iniciar(), iniciar(), RUTAS, cargarScript() (+37 more)

### Community 2 - "escaparHTML"
Cohesion: 0.11
Nodes (62): RUTAS, TITULOS, userService, guardRol(), escaparHTML(), formatearFecha(), cargarCatalogo(), abrirModal() (+54 more)

### Community 3 - "carta.js"
Cohesion: 0.05
Nodes (18): CategoryAdapter, ProductAdapter, Card, carritoRodilla, categoryService, productService, COLOR_POR_AREA, SECCION_POR_AREA (+10 more)

### Community 4 - "Icon.js"
Cohesion: 0.07
Nodes (21): aplicar(), escapar(), icon(), MAPA_REICON, NOMBRES, nombreValido(), resolver(), LINKS (+13 more)

### Community 5 - "panel.js"
Cohesion: 0.06
Nodes (17): crear(), listarMisMensajes(), MessageAdapter, resolverCliente(), ReporteAdapter, messageService, reporteService, badge() (+9 more)

### Community 6 - "carrito.js"
Cohesion: 0.14
Nodes (20): Modal, abrirCarrito(), actualizarCarrito(), agregarProducto(), cambiarCantidad(), carrito, cerrarCarrito(), configurarEventosCarrito() (+12 more)

### Community 7 - "formatearPrecio"
Cohesion: 0.12
Nodes (28): formatearPrecio(), cajaController(), abrirCierre(), cargar(), poblarSelects(), render(), renderEstadoActual(), renderHistorial() (+20 more)

### Community 8 - "build_rodilla_doc.py"
Cohesion: 0.08
Nodes (6): SPAHandler, RodillaHandler, ruta_shell(), add_body(), add_heading(), add_paragraph()

### Community 9 - "tableService.js"
Cohesion: 0.11
Nodes (18): actualizarMesa(), actualizarZona(), cambiarEstado(), conAuditoria(), eliminarMesa(), TableAdapter, actualizarMesa(), actualizarZona() (+10 more)

### Community 10 - "OrderAdapter.js"
Cohesion: 0.12
Nodes (10): crearManual(), crearPedido(), deshacerPedido(), esErrorUnique(), generarNumeroPedido(), listarMisPedidos(), OrderAdapter, resolverSesion() (+2 more)

### Community 11 - "verificar-prompt4b.mjs"
Cohesion: 0.08
Nodes (16): ARCHIVOS, bloque, cat, catAd, dash, PARES, RAIZ, RUTAS (+8 more)

### Community 12 - "CajaAdapter.js"
Cohesion: 0.11
Nodes (7): aperturarCaja(), CajaAdapter, cerrarCaja(), registrarMovimiento(), resolverSesion(), usuarioAuditoria(), cajaService

### Community 13 - "reservationService.js"
Cohesion: 0.12
Nodes (5): crear(), listarMisReservas(), ReservationAdapter, resolverCliente(), reservationService

### Community 14 - "usuariosController"
Cohesion: 0.23
Nodes (19): nombreUsuario(), rolesDe(), usuariosController(), abrirPromover(), abrirRegistro(), buscarDNIEnBD(), cerrarRegistro(), consultarDNIExterno() (+11 more)

### Community 15 - "userService.js"
Cohesion: 0.15
Nodes (5): AuthAdapter, buscarORegistrarUsuarioPorDNI(), buscarUsuarioPorDNI(), consultarDNIExterno(), registrarUsuarioManual()

### Community 18 - "UserAdapter.js"
Cohesion: 0.19
Nodes (7): buscarPersonaPorDNI(), buscarUsuarioPorDNI(), crearUsuarioManual(), promoverAdmin(), promoverAdminDirecto(), ROLES, UserAdapter

### Community 19 - "supabaseClient.js"
Cohesion: 0.18
Nodes (8): API_DNI_URL, API_RUC_URL, SUPABASE_ANON_KEY, SUPABASE_URL, configInvalida, URL_VALIDA, CORS_HEADERS, CORS_HEADERS

### Community 20 - "ventas.js"
Cohesion: 0.23
Nodes (8): supabase, clientService, consultarDNI(), dniService, normalizarRespuesta(), rucService, ESTADO_VENTA, TIPO_DOCUMENTO

### Community 24 - "vercel.json"
Cohesion: 0.25
Nodes (7): buildCommand, cleanUrls, framework, headers, installCommand, rewrites, trailingSlash

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `notifyError()` connect `notifyError` to `escaparHTML`, `carta.js`, `panel.js`, `carrito.js`, `formatearPrecio`, `usuariosController`, `ventas.js`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `notifyError` be split into smaller, more focused modules?**
  _Cohesion score 0.06158415841584158 - nodes in this community are weakly interconnected._
- **Why does `escaparHTML()` connect `escaparHTML` to `notifyError`, `carta.js`, `panel.js`, `carrito.js`, `formatearPrecio`, `usuariosController`, `ventas.js`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `authService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05220883534136546 - nodes in this community are weakly interconnected._
- **Why does `supabase` connect `ventas.js` to `carta.js`, `panel.js`, `tableService.js`, `OrderAdapter.js`, `CajaAdapter.js`, `reservationService.js`, `userService.js`, `clientService.js`, `VentaAdapter.js`, `UserAdapter.js`, `supabaseClient.js`, `EmpresaAdapter.js`, `InventarioAdapter.js`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `escaparHTML` be split into smaller, more focused modules?**
  _Cohesion score 0.10771929824561403 - nodes in this community are weakly interconnected._
- **Should `carta.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05279034690799397 - nodes in this community are weakly interconnected._
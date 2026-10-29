# Explicación Técnica - David Berrocal

## 1. Resumen de mi Rol
Yo soy el líder técnico, encargado del backend y de la base de datos. Mi código gestiona la capa de datos del sistema en PostgreSQL (Supabase): ventas, caja, inventario y reportes, además de la seguridad a nivel de filas (RLS) y las Edge Functions que ocultan las credenciales de la API de Factiliza del navegador.

## 2. ¿Cómo funciona mi código? (Flujo paso a paso)

**Al crear una venta:**
1. El controlador `js/views/dashboard/ventas.js` recibe los datos del carrito y llama a `ventaService.crearVenta(datos)` en `js/services/ventaService.js`.
2. `ventaService` delega en `VentaAdapter.crear(datos)` (`js/adapters/VentaAdapter.js`).
3. El adapter inserta la cabecera en la tabla `VENTA` (Sub_Total, IGV y Total empiezan en 0), luego inserta cada producto en `DETALLE_VENTA`.
4. Calcula los totales: `Sub_Total = Σ(Cantidad × Precio)`, `IGV = Sub_Total × 0.18` (18%) y `Total = Sub_Total + IGV`, y actualiza la fila de `VENTA`.
5. Registra el pago en `PAGO_VENTA` (monto pagado y vuelto).
6. Si el producto controla stock (`Controla_Stock = '1'`), descuenta la cantidad vendida de `PRODUCTO.Stock`.
7. Si cualquier paso falla, se borra la venta creada para no dejar datos inconsistentes.

**Al consultar reportes y caja:**
- `reporteService.kpis()` y `reporteService.ventasPorDia()` llaman a `ReporteAdapter`, que ejecuta consultas de agregación con `SUM` y `GROUP BY` sobre `VENTA` y `DETALLE_VENTA` para generar los KPIs y las exportaciones a PDF/Excel.
- `cajaService.aperturarCaja()` / `cajaService.cerrarCaja()` gestionan el turno de caja a través de `CajaAdapter`.

**Seguridad y credenciales:**
- Los archivos `sql/001_extensions.sql` a `sql/021_producto_publico.sql` definen el esquema (003 personas, 010 ventas, 009 caja, 008 pago, etc.).
- `sql/014_rls_policies.sql` activa Row Level Security para que un cliente solo vea sus propios pedidos y nunca los de otro cliente.
- Las Edge Functions `supabase/functions/consultar-dni/index.ts` y `supabase/functions/consultar-ruc/index.ts` se ejecutan en el servidor, por lo que la clave de la API de Factiliza nunca viaja al navegador.

## 3. ¿Dónde está mi código? (Arquitectura)
Mi código vive en la capa de datos y backend:
- `sql/` — definición de tablas, índices, procedimientos, semillas y políticas RLS. Es la base sobre la que todo el sistema se apoya.
- `supabase/functions/` — lógica de servidor aislada (consulta DNI/RUC a Factiliza) para proteger secretos.
- `js/adapters/` — `VentaAdapter.js`, `CajaAdapter.js`, `InventarioAdapter.js`, `ReporteAdapter.js`. Cada uno habla directamente con Supabase (tabla por tabla) y devuelve `{ ok, data/error }`.
- `js/services/` — `ventaService.js`, `cajaService.js`, `inventarioService.js`, `reporteService.js`. Orquestan los adapters y son llamados por los controladores del dashboard.
- `js/views/dashboard/` — `ventas.js`, `caja.js`, `inventario.js`, `reportes.js`. Son las vistas que consumen los servicios.
- `vercel.json` y `.vercelignore` — configuración de despliegue.

Se conecta con el resto del sistema así: el frontend (Bruno y Leonardo) llama a mis servicios, mis servicios llaman a mis adapters, y mis adapters leen/escriben en PostgreSQL. Yo proveo los datos que los demás muestran.

## 4. Preguntas frecuentes del profesor (y sus respuestas)

**P1: ¿Cómo garantizas que un cliente no pueda ver los pedidos de otro cliente?**
R: Con Row Level Security (RLS) definida en `sql/014_rls_policies.sql`. Las políticas filtran las filas de `VENTA` y `PEDIDO` por `ID_Cliente` del usuario autenticado, de modo que Supabase descarta cualquier fila que no pertenezca al cliente que hace la consulta, incluso si alguien intenta forzar el ID desde el navegador.

**P2: ¿Por qué las credenciales de la API de Factiliza no viajan al navegador?**
R: Porque las peticiones a Factiliza las resuelven las Edge Functions `supabase/functions/consultar-dni/index.ts` y `supabase/functions/consultar-ruc/index.ts`, que se ejecutan en el servidor de Supabase. El frontend solo llama a esas funciones y recibe el resultado; la clave de API permanece oculta en las variables de entorno de la función.

**P3: ¿Cómo calculas el IGV y el total de una venta sin que quede a medias si falla algo?**
R: En `VentaAdapter.crear()` inserto primero la venta con totales en cero, luego el detalle, calculo `IGV = Sub_Total × 0.18` y `Total = Sub_Total + IGV`, actualizo la venta y registro el pago. Si cualquier paso falla, borro la venta creada (`.delete().eq("ID_Venta", ...)`) para no dejar una venta incompleta ni stock descontado sin venta.

## 5. Conceptos clave que debo dominar
1. **Row Level Security (RLS)** — políticas de seguridad a nivel de fila en PostgreSQL/Supabase.
2. **Edge Functions** — funciones de servidor en Supabase que ocultan claves de API y ejecutan lógica sensible.
3. **Transacciones manuales / compensación** — patrón de insertar cabecera, detalle y, ante error, borrar lo creado para mantener consistencia.
4. **Agregaciones SQL (SUM, GROUP BY)** — consultas que generan KPIs de ventas y caja para reportes.
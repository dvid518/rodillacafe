# Explicación Técnica - Leonardo Guía

## 1. Resumen de mi Rol
Yo soy responsable del frontend, la UI/UX y los módulos de Pedidos. Mi código construye la interfaz pública (landing), el carrito de compras, los módulos de pedidos y mesas del dashboard, y los componentes reutilizables de interfaz (notificaciones, modales y tarjetas) en Vanilla JS.

## 2. ¿Cómo funciona mi código? (Flujo paso a paso)

**Carrito de compras (landing):**
1. El usuario navega por la landing (`landing.css`) y agrega productos al carrito (`js/controllers/carrito.js`).
2. El carrito se persiste en `localStorage` para que los productos no se pierdan aunque el usuario no haya iniciado sesión.
3. Al iniciar sesión, el carrito se envía al servidor para convertirse en un pedido real.

**Al crear un pedido desde el dashboard/web:**
1. El controlador `js/views/dashboard/pedidos.js` llama a `orderService.crearPedido(productos, total)` (`js/services/orderService.js`).
2. El servicio delega en `OrderAdapter.crearPedido()` (`js/adapters/OrderAdapter.js`).
3. El adapter resuelve la sesión del usuario (`resolverSesion()`), valida que tenga perfil de usuario y cliente, determina el tipo de atención ("PARA LLEVAR") y genera un número de pedido (`generarNumeroPedido()`).
4. Inserta la cabecera en `PEDIDO` y el detalle en `DETALLE_PEDIDO`. Si alguna línea es inválida, deshace la cabecera con `deshacerPedido()`.
5. El total calculado incluye el IGV del 18% (`Sub_Total × 0.18`), igual que en ventas, y se conecta con el inventario para reservar los productos.

**Gestión de mesas:**
- `tableService.js` y `TableAdapter.js` consultan la tabla `MESA` para listar mesas disponibles y su estado, usadas en `js/views/dashboard/mesas.js`.

**Componentes de UI (Vanilla JS):**
- `Notification.js`: sistema de toasts/notificaciones dinámicas.
- `Modal.js`: modales dinámicos reutilizables para el dashboard.
- `Card.js`: tarjetas reutilizables para mostrar productos y pedidos.
- Estilos en `landing.css`, `modal.css` y `components.css`.

## 3. ¿Dónde está mi código? (Arquitectura)
Mi código está en la capa de frontend y presentación:
- `js/adapters/` — `OrderAdapter.js` (habla con `PEDIDO`, `DETALLE_PEDIDO`, `USUARIO`, `TIPO_ATENCION`) y `TableAdapter.js` (habla con `MESA`).
- `js/services/` — `orderService.js` (`crearPedido`, `listarMisPedidos`, `actualizarEstado`, `eliminarPedido`, etc.) y `tableService.js`. Orquestan los adapters y son llamados por las vistas.
- `js/views/dashboard/` — `pedidos.js`, `mesas.js`. También `carrito.js` vive en `js/controllers/` y gestiona el carrito de la landing.
- `js/components/` — `Notification.js`, `Modal.js`, `Card.js`: componentes reutilizables de interfaz.
- `css/` — `landing.css`, `modal.css`, `components.css`: estilos de la landing, los modales y los componentes compartidos.

Se conecta con el resto del sistema así: mis vistas y componentes se encargan de lo que el usuario ve; mis servicios y adapters leen/escriben pedidos y mesas en PostgreSQL y dependen de la sesión y del inventario que David (backend/DB) provee.

## 4. Preguntas frecuentes del profesor (y sus respuestas)

**P1: ¿Cómo persistes el carrito antes de que el usuario inicie sesión?**
R: Uso `localStorage` del navegador en `js/controllers/carrito.js`. Los productos seleccionados se guardan localmente y, una vez que el usuario inicia sesión, se envían al servidor para crear el pedido definitivo.

**P2: ¿Cómo calculas el IGV de un pedido y por qué es importante?**
R: El IGV se calcula al 18% sobre el subtotal (`IGV = Sub_Total × 0.18`) y el `Total = Sub_Total + IGV`, de forma coherente con el módulo de ventas de David. Así el monto cobrado al cliente es correcto y cumple con la normativa tributaria.

**P3: ¿Cómo evitas que un cliente vea los pedidos de otro en el módulo de Pedidos?**
R: `OrderAdapter.listarMisPedidos()` filtra por `ID_Cliente` de la sesión resuelta (`resolverSesion()`), y la seguridad de filas (RLS) de David en la base de datos refuerza que solo se devuelvan los pedidos del cliente autenticado.

## 5. Conceptos clave que debo dominar
1. **localStorage** — persistencia del carrito en el navegador sin sesión iniciada.
2. **Vanilla JS components** — componentes reutilizables (Modal, Notification, Card) sin frameworks.
3. **IGV (18%)** — impuesto aplicado al subtotal para calcular el total de venta/pedido.
4. **Filtrado por sesión (ID_Cliente)** — aislamiento de datos por usuario autenticado en pedidos.
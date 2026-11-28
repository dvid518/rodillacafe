# Manual de Usuario — Rodilla

**Proyecto:** Rodilla — Sistema Web de Cafetería de Especialidad
**Curso:** UTP 2026-II
**URL de producción:** https://rodillacafe.vercel.app

---

## 1. ¿Qué es Rodilla?

Rodilla es el sistema web de una cafetería de especialidad (ficticia). Sirve para:

- Ver el menú público y hacer reservas de mesa.
- Registrarse e iniciar sesión como cliente.
- Hacer pedidos (carrito) y ver el historial de pedidos, reservas y mensajes.
- Si eres personal (mozo, cajero o administrador): gestionar la carta, pedidos, mesas, caja, usuarios, categorías, inventario, ventas, reportes y mensajes.

El sistema tiene **cuatro roles**:

| Rol | Qué puede hacer |
|-----|-----------------|
| **Cliente** | Ver menú, reservar mesa, hacer pedidos, consultar sus pedidos/reservas/mensajes. |
| **Mozo** | Tomar pedidos, gestionar mesas y reservas, ver mensajes. |
| **Cajero** | Todo del mozo, más ventas y caja (apertura/cierre de turno, arqueo). |
| **Administrador** | Acceso total: carta, categorías, productos, usuarios, reportes, etc. |

---

## 2. Primeros pasos

### 2.1 Entrar al sistema

Abre el navegador en:

```
https://rodillacafe.vercel.app
```

No hay que instalar nada. Funciona desde computadora, tableta o celular.

### 2.2 Crear una cuenta (cliente)

1. En la landing, haz clic en **Iniciar sesión** o **Registrarse**.
2. Se abre `auth.html` con dos pestañas: **Iniciar sesión** y **Crear cuenta**.
3. En "Crear cuenta" escribe:
   - Nombre completo
   - Correo electrónico
   - Contraseña
4. Pulsa **Crear cuenta**.
5. El sistema te crea automáticamente el perfil de cliente con rol `CLIENTE`. Ya puedes iniciar sesión.

> Los empleados (mozo, cajero, administrador) son creados por el administrador desde el panel (`/dashboard/usuarios`), no desde el registro público.

### 2.3 Iniciar sesión

1. Ve a `auth.html#/login`.
2. Escribe correo y contraseña.
3. Pulsa **Iniciar sesión**.
4. Según tu rol, el sistema te lleva:
   - Cliente → landing (`index.html`)
   - Empleado → panel de administración (`dashboard.html`)

### 2.4 Cerrar sesión

Desde el panel, haz clic en tu nombre (topbar superior) → **Cerrar sesión**. Desde la landing pública, la sesión permanece activa hasta que cierres el navegador o pasen 10 minutos sin actividad.

---

## 3. Sitio público (sin sesión)

### 3.1 Página de inicio (`index.html`)

Muestra:
- Presentación de la cafetería.
- Menú de productos (categorías de barra, cocina y vitrina).
- Sección de reservas.
- Contacto y "Nosotros".

Puedes navegar por el menú superior sin iniciar sesión.

### 3.2 Ver el menú (`#/menu`)

Lista todos los productos activos con precio, categoría e imagen. Los productos se agrupan por área de preparación (Barra, Cocina, Vitrina).

### 3.3 Reservar una mesa (`#/reservas`)

1. Debes tener sesión iniciada como cliente.
2. Elige:
   - Fecha y hora de la reserva.
   - Número de comensales.
   - Observación (opcional).
3. Pulsa **Reservar**.
4. La reserva queda en estado **Pendiente**. El personal la confirma y le asigna una mesa desde el panel (`/dashboard/reservas`).

### 3.4 Contacto / Mensaje (`#/contacto`)

Envía un mensaje con asunto y cuerpo. Queda en bandeja de entrada del personal (`/dashboard/mensajes`) con estado pendiente.

---

## 4. Panel de administración (`dashboard.html`)

Solo para usuarios con sesión y rol de empleado (mozo, cajero o administrador). El menú lateral se adapta a tu rol: solo ves las secciones que te corresponden.

### 4.1 Panel general (`/dashboard`)

Tablero con indicadores clave (KPIs):
- Pedidos, reservas, mensajes, productos y categorías.
- Gráfico de ventas de los últimos 7 días.
- Últimos pedidos y próximas reservas.

Los KPIs se actualizan solos cada 30 segundos. También hay un botón **Actualizar** para refrescar a mano.

### 4.2 Carta (`/dashboard/carta`) — solo Administrador

CRUD de productos del menú:
- **Listar:** todos los productos con precio, costo, stock, categoría y estado.
- **Crear:** nuevo producto (nombre, detalle, precio, categoría, unidad de medida, imagen, área de preparación, si controla stock, etc.).
- **Editar:** modifica solo los campos que cambies (el sistema no reescribe campos que no tocás).
- **Eliminar:** borra un producto.

> El costo y el stock interno solo los ve el administrador. El público no accede a esos datos.

### 4.3 Categorías (`/dashboard/categorias`) — solo Administrador

CRUD de categorías de producto (ej. Bebidas calientes, Repostería). No se puede borrar una categoría que tenga productos asignados.

### 4.4 Pedidos (`/dashboard/pedidos`) — Administrador, Cajero, Mozo

Lista de pedidos con cliente, fecha, total y estado:
- **P** Pendiente
- **A** Aprobado
- **F** Completado
- **X** Anulado

Desde acá el mozo/cajero toma el pedido del carrito del cliente y lo pasa a cocina/barra.

### 4.5 Mesas / Salón (`/dashboard/mesas`) — Administrador, Cajero, Mozo

Vista del salón con zonas y mesas. Cada mesa tiene un estado (libre, ocupada, reservada, sucio, etc.). El personal actualiza el estado de la mesa desde acá.

### 4.6 Reservas (`/dashboard/reservas`) — Administrador, Cajero, Mozo

Lista de reservas de clientes. El personal puede:
- Confirmar una reserva pendiente.
- Asignarle una mesa y número de mesa.
- Cancelarla.

### 4.7 Mensajes (`/dashboard/mensajes`) — Administrador, Cajero, Mozo

Bandeja de entrada de los mensajes que envían los clientes desde el formulario de contacto. El personal los lee y los marca como atendidos.

### 4.8 Clientes (`/dashboard/clientes`) — Administrador

Listado de clientes registrados con sus datos (nombre, documento, correo, teléfono, tipo de cliente, puntos).

### 4.9 Empresas (`/dashboard/empresas`) — Administrador

Listado de empresas clientes (personas jurídicas) con RUC, razón social, dirección y teléfono.

### 4.10 Usuarios (`/dashboard/usuarios`) — solo Administrador

Gestión de usuarios del sistema:
- Crear, editar y desactivar usuarios.
- Asignar roles (ADMINISTRADOR, CAJERO, MOZO, CLIENTE).
- Vincular cada usuario con su perfil de empleado o cliente.

### 4.11 Ventas (`/dashboard/ventas`) — Administrador, Cajero

Listado de ventas facturadas con comprobante (boleta o factura), cliente, total, método de pago y estado.

### 4.12 Caja (`/dashboard/caja`) — Administrador, Cajero

Control de caja por turno:
- **Apertura:** declarar monto inicial de efectivo.
- **Movimientos:** ingresos y egresos por concepto.
- **Arqueo / Cierre:** declarar el efectivo contado al final del turno. El sistema calcula la diferencia contra lo registrado.

### 4.13 Inventario (`/dashboard/inventario`) — Administrador

Control de stock de productos: ver stock actual, mínimo y movimientos.

### 4.14 Reportes (`/dashboard/reportes`) — Administrador

Reportes de ventas por día y otros indicadores del negocio.

### 4.15 Mis pedidos / Mis reservas / Mis mensajes — solo Cliente

Desde el panel, el cliente ve solo su propia información:
- Sus pedidos y estados.
- Sus reservas y estados.
- Sus mensajes enviados y respuestas.

---

## 5. Carrito de compras (cliente)

El carrito vive en el navegador (`localStorage`), no en el servidor, hasta que confirmas el pedido.

1. Desde el menú público, agrega productos al carrito.
2. Abre el cajón del carrito (ícono del carrito).
3. Revisa productos, cantidades y total.
4. Pulsa **Confirmar pedido** (requiere sesión iniciada).
5. El pedido se registra en el sistema y el personal lo ve en `/dashboard/pedidos`.

---

## 6. Reglas importantes de la sesión

- **Tiempo de inactividad:** si no usas el sistema durante 10 minutos, la sesión se cierra automáticamente. Se te redirige al login con el aviso "Sesión expirada".
- **Un solo rol activo:** el sistema usa tu rol principal para mostrar el menú. Si tienes varios roles, se muestra el de mayor jerarquía.
- **Seguridad:** cada tabla de la base de datos filtra lo que puedes ver según tu rol. Aunque adivines una URL, la base de datos no te devuelve datos que no te corresponden.

---

## 7. Soporte

Si algo no funciona:
1. Revisa que tengas conexión a internet.
2. Revisa la consola del navegador (F12 → Consola) por mensajes de error.
3. Si el backend de Supabase no responde, aparece un aviso "No se pudo conectar con el servidor de autenticación". Intenta recargar la página.
4. Reporta el problema al administrador del sistema o docente del curso.

---

## Apéndice — Rutas rápidas

| Sección | URL (hash) | Quién accede |
|---------|-----------|--------------|
| Inicio | `index.html` | Todos |
| Menú | `index.html#/menu` | Todos |
| Reservas (cliente) | `index.html#/reservas` | Cliente con sesión |
| Contacto | `index.html#/contacto` | Todos |
| Login | `auth.html#/login` | Todos |
| Registro | `auth.html#/register` | Todos |
| Panel | `dashboard.html#/dashboard` | Empleados + Cliente |
| Carta | `dashboard.html#/dashboard/carta` | Administrador |
| Pedidos | `dashboard.html#/dashboard/pedidos` | Admin, Cajero, Mozo |
| Mesas | `dashboard.html#/dashboard/mesas` | Admin, Cajero, Mozo |
| Reservas (panel) | `dashboard.html#/dashboard/reservas` | Admin, Cajero, Mozo |
| Mensajes | `dashboard.html#/dashboard/mensajes` | Admin, Cajero, Mozo |
| Caja | `dashboard.html#/dashboard/caja` | Admin, Cajero |
| Usuarios | `dashboard.html#/dashboard/usuarios` | Administrador |
| Reportes | `dashboard.html#/dashboard/reportes` | Administrador |
| Mis pedidos | `dashboard.html#/dashboard/mis-pedidos` | Cliente |
| Mis reservas | `dashboard.html#/dashboard/mis-reservas` | Cliente |
| Mis mensajes | `dashboard.html#/dashboard/mis-mensajes` | Cliente |

---

*Fin del manual de usuario.*
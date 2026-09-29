# Capítulo II — Arquitectura del Sistema

**Proyecto:** Rodilla — Cafetería de especialidad
**Curso:** UTP 2026-II
**Documento generado:** a partir del código fuente y de los scripts SQL del repositorio.

---

## 1. Descripción general

### 1.1 ¿Qué es Rodilla?

Rodilla es un **sistema web de gestión integral para una cafetería de especialidad**. El proyecto
nace como un caso de estudio académico: modela de principio a fin la operación real de un
establecimiento de foods & drinks, desde la toma de pedidos por el cliente hasta la emisión del
comprobante y el cuadre de caja, pasando por catálogo, reservas, mensajería y control de accesos.

El negocio es ficticio, pero el modelado de datos no lo es: el esquema reproduce los patrones de un
sistema de producción peruano real (DNI/RUC, boleta y factura electrónica con campos SUNAT, IGV,
caja por turnos con arqueo y diferencia).

### 1.2 ¿Qué hace el sistema?

El sistema cubre siete procesos del negocio:

| Proceso | Descripción |
|---|---|
| **Autenticación** | Registro, inicio y cierre de sesión, con verificación de rol. |
| **Catálogo** | Consulta pública del menú y CRUD privado de productos, categorías y unidades de medida. |
| **Pedidos** | Carrito en el cliente, comanda en la barra, y cierre con venta y comprobante. |
| **Reservas** | Reserva de mesa por fecha y número de comensales, con estados de seguimiento. |
| **Mensajería** | Buzón de contacto para clientes y bandeja de entrada para el personal. |
| **Salón** | Zonas, mesas y estados de mesa; el operativo actualiza el estado desde el panel. |
| **Caja** | Apertura por turno, registro de ingresos y egresos, y arqueo con declaración de monto. |
| **Seguridad** | Usuarios, roles, permisos por módulo y auditoría de cambios. |

### 1.3 Usuarios del sistema

El sistema distingue **cuatro roles**, sembrados en la tabla `ROL` con un nivel de jerarquía:

| Rol | Nivel | Descripción | Alcance en el panel |
|---|---|---|---|
| **ADMINISTRADOR** | 1 | Acceso total al sistema | Las 7 secciones del menú lateral |
| **CAJERO** | 2 | Ventas, comprobantes y caja | Pedidos, reservas, mensajes |
| **MOZO** | 3 | Solo toma de pedidos | Pedidos, reservas, mensajes |
| **CLIENTE** | 4 | Cliente registrado de Rodilla | Sus pedidos, reservas y mensajes |

El acceso no se limita al menú visible: cada control de pantalla consulta el rol con
`roleGuard.js`, y cada tabla de la base de datos aplica una política RLS independiente. El usuario
ve únicamente las secciones que su rol autoriza, y aunque manipule la URL, la base de datos
devuelve cero filas.

Adicionalmente existe la tabla `TIPO_USUARIO` (`ADMINISTRADOR`, `OPERATIVO`, `CLIENTE`), que
clasifica al usuario por su naturaleza contractual, distinta de su rol operativo. Un empleado es
`OPERATIVO` aunque sea `CAJERO`; el cliente es `CLIENTE` y su rol es `CLIENTE`.

---

## 2. Arquitectura tecnológica

```
┌─────────────────────────── NAVEGADOR (Vercel) ───────────────────────────┐
│                                                                            │
│   HTML ── CSS ── Icon.js ──▶ <re-icon> (CDN, web component)               │
│     │                                                                        │
│     └── js/controllers/  (3 entry points + carrito)                        │
│              │                                                                 │
│              ▼                                                                 │
│         js/views/  ── render ──▶  js/components/  (DOM)                    │
│              │                                                                 │
│              ▼                                                                 │
│         js/services/   (reglas de negocio, return {ok, data|error})          │
│              │                                                                 │
│              ▼                                                                 │
│         js/adapters/   ← ÚNICA capa que habla con Supabase                 │
│              │                                                                 │
└──────────────┼─────────────────────────────────────────────────────────────┘
               │  supabase-js v2 (ESM desde esm.sh)
               ▼
┌──────────────────────── SUPABASE (PostgreSQL) ───────────────────────────┐
│                                                                            │
│   PostgREST  ──  41 tablas  ·  1 vista  ·  61 índices  ·  47 policies RLS   │
│                                                                            │
│   Auth  ──  GoTrue  (email + password)                                     │
│                 │                                                          │
│                 └──▶ trigger `fn_handle_new_user()`                        │
│                          crea PERSONA + CLIENTE + USUARIO + USUARIO_ROL   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Frontend

**Vanilla JS con módulos ES nativos.** Sin framework, sin bundler, sin paso de compilación. El
código que llega al navegador es exactamente el que está en el repositorio, lo que elimina toda
la clase de errores introduce por un proceso de build.

- **JavaScript** — módulos ES (`import` / `export`), tipado por convención de JSDoc en los
  comentarios. Cero dependencias npm.
- **HTML** — 3 páginas raíz + 17 parciales inyectados por el router.
- **CSS** — 11 hojas, organizadas en tokens, base, componentes y páginas.
- **Reicon** — librería de iconos (web component) vía CDN, en modo **Filled**. Expone
  `icon(nombre)` y `icono(nombre)` como única API; ninguna vista dibuja SVG a mano.

### 2.2 Backend

**Supabase** actúa como backend-as-a-service sobre PostgreSQL:

- **PostgreSQL** — 41 tablas, claves foráneas, checks de integridad y 61 índices.
- **Auth (GoTrue)** — autenticación por correo y contraseña, con JWT de sesión.
- **RLS (Row Level Security)** — 47 políticas que filtran filas *y* columnas en el motor, no en la
  aplicación. Es la frontera de seguridad real del sistema.
- **Triggers** — `fn_handle_new_user()` (alta automática de perfil), `fn_usuario_proteger_cols()`
  (impide que un usuario se auto-otorgue privilegios), `fn_tr_movimiento_caja_acumula()` (acumula
  el arqueo de caja).

### 2.3 Hosting

**Vercel**, con despliegue estático. El repositorio incluye `vercel.json` (configuración de
cabeceras, `cleanUrls`) y `.vercelignore` (excluye `sql/` y `work/` del artefacto de despliegue).
Ver la sección 8.

### 2.4 Router: hash-based

La navegación usa **hash routing** (`/#/menu`, `/auth.html#/login`,
`/dashboard.html#/dashboard/carta`). El `Router` de `js/lib/router.js`:

1. Lee `window.location.hash` y busca la ruta en su tabla de rutas.
2. Hace `fetch()` del parcial `views/<seccion>/<vista>.html`.
3. Inyecta el HTML con `innerHTML` en el contenedor (`#app`).
4. Invoca el controlador de la vista, que recibe el nodo ya populado.
5. Si el controlador devuelve una función, la guarda como *cleanup* y la ejecuta al salir de la
   vista (evita fugas de listeners entre navegaciones).

La ventaja operacional es decisive: como la ruta vive en el fragmento, **el servidor nunca recibe
la petición de navegación**. Sirve el mismo `index.html` para todas las rutas y no hace falta
configurar reglas de reescritura ni depender de un *fallback* SPA. Además funciona al abrir el
proyecto desde un servidor local sin configuración adicional.

---

## 3. Estructura de carpetas

```
rodilla-main/
│
├── index.html              Landing (punto de entrada público)
├── auth.html               Login y registro
├── dashboard.html          Panel administrativo/operativo/cliente
├── manifest.webmanifest    Manifiesto PWA
├── vercel.json             Configuración de despliegue en Vercel
├── .vercelignore           Exclusiones del artefacto de despliegue
├── README.md
│
├── css/
│   ├── style.css               Tokens de diseño (variables CSS)
│   ├── base/
│   │   ├── reset.css           Normalización y estilos base
│   │   └── typography.css      Escala tipográfica
│   ├── components/
│   │   ├── components.css      Botones, tarjetas, tablas, notificaciones
│   │   ├── modal.css           Modales, overlays y estado de carga
│   │   ├── navigation.css      Navbar y footer
│   │   ├── sidebar.css         Menú lateral del panel
│   │   └── topbar.css          Barra superior del panel
│   └── pages/
│       ├── landing.css         Estilos del sitio público
│       ├── auth.css            Pantalla de acceso
│       └── dashboard.css       Estilos del panel
│
├── js/
│   ├── lib/                    ── INFRAESTRUCTURA
│   │   ├── supabaseClient.js       Única instancia del cliente de Supabase
│   │   └── router.js               Router hash-based
│   │
│   ├── adapters/               ── PUERTA A DATOS (7 archivos)
│   │   ├── AuthAdapter.js          Login, registro, sesión
│   │   ├── UserAdapter.js          Perfil, roles, clientes
│   │   ├── ProductAdapter.js       Catálogo y CRUD de productos
│   │   ├── CategoryAdapter.js      CRUD de categorías
│   │   ├── OrderAdapter.js         Pedidos y tipos de atención
│   │   ├── ReservationAdapter.js   Reservas
│   │   └── MessageAdapter.js       Mensajes
│   │
│   ├── services/               ── REGLAS DE NEGOCIO (7 archivos)
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── productService.js
│   │   ├── categoryService.js
│   │   ├── orderService.js
│   │   ├── reservationService.js
│   │   └── messageService.js
│   │
│   ├── controllers/            ── PUNTOS DE ENTRADA (4 archivos)
│   │   ├── landing.js              Monta el router del sitio público
│   │   ├── auth.js                 Monta el router de acceso
│   │   ├── dashboard.js            Monta sidebar, topbar y router del panel
│   │   └── carrito.js              Drawer del carrito (se auto-inicializa)
│   │
│   ├── views/                  ── CONTROLADORES DE VISTA (20 archivos)
│   │   ├── landing/                home, menu, reservas, contacto, nosotros
│   │   ├── auth/                   login, register
│   │   └── dashboard/              panel, carta, categorias, pedidos, reservas,
│   │                              mensajes, usuarios, mis-pedidos, mis-reservas,
│   │                              mis-mensajes, crud-comun, mis-comun
│   │
│   ├── components/             ── ELEMENTOS DE UI REUTILIZABLES (9 archivos)
│   │   ├── Icon.js                 Fábrica de iconos (Reicon, modo Filled)
│   │   ├── Navbar.js               Barra de navegación
│   │   ├── Footer.js               Pie de página
│   │   ├── Sidebar.js              Menú lateral según rol
│   │   ├── Topbar.js               Barra superior con tema y sesión
│   │   ├── Modal.js                Diálogo modal
│   │   ├── Card.js                 Tarjeta de producto
│   │   ├── Loading.js              Overlay de carga
│   │   └── Notification.js         Toasts
│   │
│   ├── session/                ── CONTROL DE ACCESO (3 archivos)
│   │   ├── guard.js                Exige sesión; redirige a auth.html
│   │   ├── roleGuard.js            Exige uno de los roles indicados
│   │   └── opcionalSesion.js       Sesión o null, sin redirigir
│   │
│   └── utils/                  ── UTILIDADES (2 archivos)
│       ├── format.js               Fechas, moneda y escape de HTML
│       └── notify.js               Fachada de las notificaciones
│
├── views/                     ── PARCIALES HTML (17 archivos)
│   ├── landing/                home, menu, reservas, contacto, nosotros
│   ├── auth/                   login, register
│   └── dashboard/              panel, carta, categorias, pedidos, reservas,
│                               mensajes, usuarios, mis-pedidos, mis-reservas,
│                               mis-mensajes
│
├── img/
│   ├── avif/                   Fondos optimizados (.avif)
│   ├── jpg/                    Fondos alternativos (.jpg)
│   └── pwa/                    Recursos de la PWA
│
├── sql/                       ── ESQUEMA Y SEGURIDAD (23 archivos, NO se despliega)
│   ├── 001_extensions.sql      Extensiones de PostgreSQL
│   ├── 002_geografia.sql       Departamento, provincia, distrito
│   ├── 003_personas.sql        Tipo de identidad, persona, empresa, cliente
│   ├── 004_rrhh.sql            Cargo, contrato, empleado
│   ├── 005_seguridad.sql       Usuario, rol, permiso, auditoría
│   ├── 006_catalogo.sql        Unidad de medida, categoría, producto
│   ├── 007.sql                 Zona, estado de mesa, mesa, tipo de atención
│   ├── 008_pago.sql            Método de pago, serie de comprobante
│   ├── 009_caja.sql            Caja, apertura, movimiento, arqueo
│   ├── 010_ventas.sql          Pedido, venta, boleta, factura
│   ├── 011_rodilla_nuevas.sql  Reserva y mensaje
│   ├── 012_indexes.sql         Índices
│   ├── 013_auth_trigger.sql    Trigger de alta automática de usuario
│   ├── 014_rls_policies.sql    Row Level Security
│   ├── 015_seed_data.sql       Datos iniciales
│   ├── 016_procedimientos.sql  Procedimientos almacenados
│   ├── 017_seed_transaccional.sql
│   ├── 018_fixes.sql           Correcciones del esquema
│   ├── 018_link_admin.sql
│   ├── 019_indexes_extra.sql
│   ├── 020_bootstrap_admin.sql Bootstrap del primer administrador
│   └── 021_producto_publico.sql  Vista pública y cierre de fuga de datos
│
├── docs/
│   └── ARQUITECTURA.md         Este documento
│
└── work/                       ── BATERÍA DE PRUEBAS MANUALES (NO se despliega)
    ├── verificar-prompt4.mjs       Comprobaciones de integración
    ├── verificar-prompt4b.mjs      Comprobaciones de integración
    └── *.html                       Páginas de prueba aislada
```

> **Nota sobre `sql/` y `work/`:** ambos directorios están listados en `.vercelignore`, por lo que
> Vercel no los sube al despliegue. El esquema se aplica a mano desde el SQL Editor de Supabase.

---

## 4. Modelo de base de datos

El esquema comprises **41 tablas** agrupadas en diez dominios. Todas tienen RLS habilitado
(41/41), usan claves primarias identity, la convención de nomenclatura `SCREAMING_SNAKE_CASE` en
español, y las mismas columnas de auditoría: `USUCRE`, `PCCRE`, `FECCRE`, `USUMOD`, `PCMOD`,
`FECMOD` y el indicador lógico `ESTADO`.

### 4.1 Geografía (3 tablas)

Jerarquía administrativa peruana.

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `DEPARTAMENTO` | `ID_Departamento`, `N_Departamento`, `ESTADO` | — |
| `PROVINCIA` | `ID_Provincia`, `ID_Departamento`, `N_Provincia`, `ESTADO` | → `DEPARTAMENTO` |
| `DISTRITO` | `ID_Distrito`, `ID_Provincia`, `D_Distrito`, `ESTADO` | → `PROVINCIA` |

### 4.2 Personas (4 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `TIPO_IDENTIDAD` | `ID_TipoIdentidad`, `N_TipoIdentidad`, `Abreviatura`, `Longitud`, `Codigo_SUNAT` | — |
| `PERSONA` | `ID_Persona`, `ID_TipoIdentidad`, `N_Documento`, `Nombre`, `Ap_Paterno`, `Ap_Materno`, `F_Nacimiento`, `EMAIL`, `Celular`, `Genero`, `Direccion` | → `TIPO_IDENTIDAD`, `DISTRITO` |
| `EMPRESA` | `ID_Empresa`, `RUC`, `Razon_Social`, `Nombre_Comercial`, `Direccion`, `Telefono` | → `DISTRITO` |
| `CLIENTE` | `ID_Cliente`, `ID_Persona`, `ID_Empresa`, `Tipo_Cliente`, `Puntos`, `F_Registro` | → `PERSONA`, `EMPRESA` |

> `PERSONA` y `EMPRESA` se separan porque un cliente puede ser persona natural o jurídica, y
> ambos pueden registrar pedidos. `CLIENTE` es la entidad que compra; hereda sus datos de una de
> las dos.

### 4.3 Recursos Humanos (3 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `CARGO` | `ID_Cargo`, `N_Cargo` | — |
| `CONTRATO` | `ID_Contrato`, `N_Contrato`, `Descripcion` | — |
| `EMPLEADO` | `ID_Empleado`, `ID_Persona`, `ID_Contrato`, `ID_Cargo`, `Salario`, `Turno`, `Fondo_Pension`, `ESSALUD`, `F_Ingreso`, `F_Cese` | → `PERSONA`, `CONTRATO`, `CARGO` |

### 4.4 Seguridad (8 tablas)

Núcleo del control de acceso.

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `TIPO_USUARIO` | `ID_TipoUsuario`, `N_TipoUsuario` | — |
| `USUARIO` | `ID_Usuario`, `ID_TipoUsuario`, `ID_Empleado`, `ID_Cliente`, **`auth_id` (UUID)**, `Logeo`, `Intentos`, `Bloqueado`, `F_UltimoAcceso` | → `TIPO_USUARIO`, `EMPLEADO`, `CLIENTE`, `auth.users` |
| `MODULO` | `ID_Modulo`, `N_Modulo`, `Descripcion`, `Icono`, `Orden` | — |
| `ROL` | `ID_Rol`, `N_Rol`, `Descripcion`, `Nivel` | — |
| `PERMISO` | `ID_Permiso`, `ID_Modulo`, `N_Permiso`, `Clave`, `Descripcion` | → `MODULO` |
| `ROL_PERMISO` | `ID_RolPermiso`, `ID_Rol`, `ID_Permiso`, `Concedido` | → `ROL`, `PERMISO` |
| `USUARIO_ROL` | `ID_UsuarioRol`, `ID_Usuario`, `ID_Rol`, `F_Asignacion`, **`Vigente`** | → `USUARIO`, `ROL` |
| `AUDITORIA` | `ID_Auditoria`, `ID_Usuario`, `N_Tabla`, `Accion`, `ID_Registro`, `Valor_Anterior`, `Valor_Nuevo`, `F_Evento`, `IP`, `Terminal` | → `USUARIO` |

> **`auth_id`** es la columna puente con `auth.users` de Supabase Auth. Es lo que permite a las
> políticas RLS identificar al usuario con `auth.uid()`. **`Vigente`** en `USUARIO_ROL` permite
> desactivar una asignación de rol sin borrarla, conservando el histórico.

### 4.5 Catálogo (3 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `UNIDAD_MEDIDA` | `ID_UnidadMedida`, `N_UnidadMedida`, `Abreviatura` | — |
| `CATEGORIA_PRODUCTO` | `ID_CategoriaProducto`, `N_CategoriaProducto`, `Descripcion`, `Area_Preparacion` | — |
| `PRODUCTO` | `ID_Producto`, `ID_CategoriaProducto`, `ID_UnidadMedida`, `N_Producto`, `Detalle`, `Precio`, `Costo`, `Marca`, `Codigo_Barras`, `Controla_Stock`, `Stock_Actual`, `Stock_Minimo`, `Es_Preparado`, `Afecto_IGV`, `Imagen` | → `CATEGORIA_PRODUCTO`, `UNIDAD_MEDIDA` |

> `Area_Preparacion` (`BARRA`, `COCINA`, `VITINA`) determina en qué pestaña y con qué color se
> muestra el producto en el menú. `Costo` y `Stock_Actual` son datos internos: **nunca se exponen al
> público** (ver §5.4).

### 4.6 Salón (4 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `ZONA` | `ID_Zona`, `N_Zona`, `Descripcion` | — |
| `ESTADO_MESA` | `ID_EstadoMesa`, `Descripcion`, `Color` | — |
| `MESA` | `ID_Mesa`, `ID_Zona`, `ID_EstadoMesa`, `Numero`, `Capacidad`, `Detalle` | → `ZONA`, `ESTADO_MESA` |
| `TIPO_ATENCION` | `ID_TipoAtencion`, `N_TipoAtencion`, `Requiere_Mesa` | — |

### 4.7 Pago (2 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `METODO_PAGO` | `ID_MetodoPago`, `N_MetodoPago`, `Es_Efectivo`, `Requiere_Ref` | — |
| `SERIE_COMPROBANTE` | `ID_Serie`, `TipoDocumento`, `Serie`, `Correlativo`, `Descripcion` | — |

### 4.8 Caja (5 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `CAJA` | `ID_Caja`, `N_Caja`, `Ubicacion`, `Serie_Terminal`, `Moneda`, `Monto_Base`, `Aperturada` | — |
| `APERTURA_CAJA` | `ID_AperturaCaja`, `ID_Caja`, `ID_Usuario`, `ID_UsuarioCierre`, `Numero_Turno`, `F_Apertura`, `F_Cierre`, `Monto_Inicial`, `Total_Ingresos`, `Total_Egresos`, `Monto_Sistema`, `Monto_Declarado`, `Diferencia`, `Situacion` | → `CAJA`, `USUARIO` |
| `TIPO_MOVIMIENTO_CAJA` | `ID_TipoMovimiento`, `N_TipoMovimiento`, `Abreviatura`, `Signo` | — |
| `CONCEPTO_CAJA` | `ID_Concepto`, `ID_TipoMovimiento`, `N_Concepto`, `Afecta_Efectivo` | → `TIPO_MOVIMIENTO_CAJA` |
| `MOVIMIENTO_CAJA` | `ID_MovimientoCaja`, `ID_AperturaCaja`, `ID_TipoMovimiento`, `ID_Concepto`, `ID_MetodoPago`, `ID_Usuario`, `ID_Pedido`, `ID_Venta`, `Numero_Operacion`, `Monto`, `F_Movimiento`, `IP`, `Terminal` | → `APERTURA_CAJA`, `USUARIO`, `PEDIDO`, `VENTA` |

> El par `Monto_Sistema` / `Monto_Declarado` / `Diferencia` implementa el **arqueo de turno**: al
> cerrar la caja el cajero declara el efectivo contado y el sistema calcula la diferencia. El
> trigger `fn_tr_movimiento_caja_acumula()` mantiene los totales al día.

### 4.9 Ventas (7 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `PEDIDO` | `ID_Pedido`, `ID_Mesa`, `ID_Cliente`, `ID_Usuario`, `ID_TipoAtencion`, `Numero_Pedido`, `F_Pedido`, `F_Cierre`, `N_Comensales`, `Total`, `Situacion` | → `MESA`, `CLIENTE`, `USUARIO`, `TIPO_ATENCION` |
| `DETALLE_PEDIDO` | `ID_DetallePedido`, `ID_Pedido`, `ID_Producto`, `Cantidad`, `Precio`, `Descuento`, `Sub_Total`, `Nota`, `Situacion` | → `PEDIDO`, `PRODUCTO` |
| `VENTA` | `ID_Venta`, `ID_Pedido`, `ID_Cliente`, `ID_Usuario`, `ID_AperturaCaja`, `Numero_Venta`, `F_Venta`, `TipoDocumento`, `Sub_Total`, `Descuento`, `IGV`, `Total`, `T_Pagado`, `Vuelto`, `Situacion` | → `PEDIDO`, `CLIENTE`, `APERTURA_CAJA` |
| `DETALLE_VENTA` | `ID_Detalle`, `ID_Venta`, `ID_Producto`, `Cantidad`, `Precio`, `Descuento`, `Sub_Total` | → `VENTA`, `PRODUCTO` |
| `BOLETA` | `ID_Boleta`, `ID_Venta`, `F_Emision`, `Serie`, `Numero`, `Cliente_Doc`, `Cliente_Nombre`, `Hash_SUNAT`, `Situacion_SUNAT` | → `VENTA` |
| `FACTURA` | `ID_Factura`, `ID_Venta`, `F_Emision`, `Serie`, `Numero`, `RUC`, `Razon_Social`, `Direccion_Fiscal`, `Hash_SUNAT`, `Situacion_SUNAT` | → `VENTA` |
| `PAGO_VENTA` | `ID_PagoVenta`, `ID_Venta`, `ID_MetodoPago`, `Monto`, `Referencia`, `F_Pago` | → `VENTA`, `METODO_PAGO` |

> `PEDIDO` y `VENTA` están separadas a propósito: el pedido es la **intención de compra**
> (lo que el cliente pide) y la venta es la **operación facturada** (lo que se cobró y se
> registró en caja). Una venta puede existir sin pedido (venta manual) y un pedido se convierte en
> venta al cerrarse.

### 4.10 Módulos propios de Rodilla (2 tablas)

| Tabla | Columnas principales | Relaciones |
|---|---|---|
| `RESERVA` | `ID_Reserva`, `ID_Cliente`, `ID_Mesa`, `Numero_Mesa`, `N_Comensales`, `F_Reserva`, `Situacion`, `Observacion` | → `CLIENTE`, `MESA` |
| `MENSAJE` | `ID_Mensaje`, `ID_Cliente`, `Asunto`, `Mensaje`, `Situacion`, `F_Envio` | → `CLIENTE` |

> Estas dos tablas nacen en `011_rodilla_nuevas.sql`: son la ampliación propia de la cafetería
> sobre el esquema base. Aportan el valor funcional que distingue a Rodilla de un sistema de
> mostrador genérico.

### 4.11 Vista y objetos de base de datos

| Objeto | Tipo | Descripción |
|---|---|---|
| `PRODUCTO_PUBLICO` | Vista | Catálogo público: solo `ID_Producto`, `ID_CategoriaProducto`, `ID_UnidadMedida`, `N_Producto`, `Detalle`, `Precio`, `Imagen`, `ESTADO` (con `ESTADO = '1'`). |
| `is_admin()` | Función | ¿El usuario autenticado es ADMINISTRADOR? |
| `is_rol(text)` | Función | ¿El usuario tiene el rol indicado? |
| `is_operativo()` | Función | ¿Es CAJERO o MOZO? |
| `is_owner_cliente(int)` | Función | ¿El usuario es dueño de ese `ID_Cliente`? |
| `fn_handle_new_user()` | Trigger | Alta automática de `PERSONA` + `CLIENTE` + `USUARIO` + `USUARIO_ROL`. |
| `fn_usuario_proteger_cols()` | Trigger | Impide la auto-elevación de privilegios. |
| `fn_tr_movimiento_caja_acumula()` | Trigger | Acumula ingresos y egresos de la apertura. |

Índices: **61** en total, definidos en `012_indexes.sql` y `019_indexes_extra.sql`, sobre claves
foráneas, columnas de búsqueda frecuente y los campos de auditoría.

---

## 5. Roles y permisos

### 5.1 El modelo de dos niveles

Rodilla combina dos mecanismos que se refuerzan:

1. **Permisos por rol** (`ROL` → `PERMISO` vía `ROL_PERMISO`), organizados por `MODULO`. Es el
   modelo de permisos fino, pensado para administration desde la interfaz.
2. **Políticas RLS** (`is_admin()`, `is_rol()`, `is_owner_cliente()`), que es lo que realmente hace
   cumplir el acceso en el motor.

El segundo es el que manda. Las políticas no consultan `ROL_PERMISO`: evaluate directamente el rol
del usuario autenticado. La razón es de seguridad: una política que dependiera de permisos
modificables en caliente abriría la puerta a que alguien se auto-asignara el permiso y obtuviera
acceso.

### 5.2 Módulos y permisos sembrados

| Módulo | Orden | Permisos |
|---|---|---|
| `SEGURIDAD` | 1 | `SEG_USUARIO`, `SEG_ROL` |
| `CLIENTES` | 2 | `CLI_GESTIONAR` |
| `PRODUCTOS` | 3 | `PRO_GESTIONAR` |
| `PEDIDOS` | 4 | (comandas y mesas) |

### 5.3 Matriz de acceso por sección del panel

| Sección | ADMINISTRADOR | CAJERO | MOZO | CLIENTE |
|---|:---:|:---:|:---:|:---:|
| Panel general | Sí | Sí | Sí | Sí |
| Carta (productos) | Sí | — | — | — |
| Categorías | Sí | — | — | — |
| Pedidos | Sí | Sí | Sí | — |
| Reservas | Sí | Sí | Sí | — |
| Mensajes | Sí | Sí | Sí | — |
| Usuarios | Sí | — | — | — |
| Mis pedidos | — | — | — | Sí |
| Mis reservas | — | — | — | Sí |
| Mis mensajes | — | — | — | Sí |

El menú lateral (`Sidebar.js`) construye su contenido a partir del rol, y `roleGuard.js` vuelve a
validar el rol dentro de cada controlador. La última fila de la matriz se explica en §5.4.

### 5.4 RLS por tabla

Las **47 políticas** siguen una convención de nombre consistente
(`p_<abreviatura>_<acción>_<sujeto>`), lo que hace la superficie de seguridad auditable de un
vistazo:

| Patrón | Significado |
|---|---|
| `p_*_select_all` | Lectura pública (catálogo y tablas de apoyo). `using (true)`. |
| `p_*_admin_all` | Escritura completa, solo ADMINISTRADOR. `is_admin()`. |
| `p_*_select_own_or_admin` | El dueño del registro o un admin. `is_owner_cliente(...) or is_admin()`. |
| `p_*_update_own_or_admin` | Igual, para escritura. |
| `p_mesa_operativo_update` | CAJERO o MOZO actualizan el estado de las mesas. `is_operativo()`. |

Aplicado tabla por tabla:

| Grupo | Tablas | Política |
|---|---|---|
| Catálogo | `CATEGORIA_PRODUCTO`, `UNIDAD_MEDIDA`, `TIPO_ATENCION`, `METODO_PAGO`, `ZONA`, `ESTADO_MESA`, `MESA` | `select_all` + `admin_all` |
| Producto | `PRODUCTO` | `admin_all` únicamente (el SELECT público se cerró, ver abajo) |
| Identidad | `USUARIO` | `select_own` / `update_own` por `auth_id = auth.uid()`, más `admin_all` |
| Titulares | `PERSONA`, `CLIENTE` | `select_own_or_admin`, `update_own_or_admin`, `admin_all` |
| Transaccional | `PEDIDO`, `DETALLE_PEDIDO`, `RESERVA`, `MENSAJE` | `select_own_or_admin`, `update_own_or_admin`, `admin_all` |
| Salón | `MESA` | `admin_all` + `operativo_update` |

Las cuatro funciones de apoyo están declaradas como `security definer`, `stable` y con
`set search_path = public`, para poder leer las tablas de seguridad desde las políticas sin caer en
recursión de RLS y sin quedar expuestas a inyección de esquema.

### 5.5 El caso de `PRODUCTO`: cerrar una fuga de datos reales

`014_rls_policies.sql` creó `p_productos_select_all` con `using (true)` para que el menú público
pudiera leer el catálogo. Eso era correcto a nivel de filas, pero **insuficiente a nivel de
columnas**: con la clave publicable (que viaja dentro del bundle público) cualquiera podía pedir

```
GET /rest/v1/PRODUCTO?select=N_Producto,Precio,Costo
```

y obtener el costo y el margen de los 16 productos del catálogo.

`021_producto_publico.sql` corrige el problema en cuatro pasos:

1. Crea la vista `PRODUCTO_PUBLICO` con las 8 columnas que el menú necesita, filtrando
   `ESTADO = '1'`.
2. Concede `SELECT` sobre la vista a `anon` y `authenticated`.
3. Revoca `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre la tabla base a `anon`.
4. Elimina la política `p_productos_select_all`.

`ProductAdapter.listar()` apunta a la vista; `listarAdmin()` sigue usando la tabla completa, que
ahora solo alcanza al administrador autenticado.

> **La vista se crea deliberadamente sin `security_invoker`.** Así se ejecuta con los permisos de
> su propietario (`postgres`) e ignora las políticas de `PRODUCTO`, que es exactamente lo que se
> busca: la vista filtra por sí misma. Ponerle `security_invoker = true` la haría exigir al
> visitante permisos sobre `PRODUCTO` que ya no tiene, y el menú dejaría de funcionar.
>
> **Orden de despliegue:** este archivo se aplica *después* de desplegar el `ProductAdapter.js` que
> lee de `PRODUCTO_PUBLICO`. Al revés, el menú se queda sin productos durante la ventana de
> despliegue.

---

## 6. Capas del frontend

El frontend se organiza en capas con una regla de dependencia estricta: **las capas superiores
pueden importar hacia abajo, nunca al revés.**

```
        controllers/          Composición: tabla de rutas, sidebar, topbar
              ↓
          views/              Interacción con el DOM de una vista concreta
              ↓
          services/           Reglas de negocio, independientes del transporte
              ↓
          adapters/           Traducción a la API de Supabase
              ↓
          lib/                Cliente de Supabase y router
```

### 6.1 `lib/` — infraestructura

| Archivo | Responsabilidad |
|---|---|
| `supabaseClient.js` | Instancia única del cliente de Supabase (`createClient` desde `esm.sh`). Exporta `supabase`. |
| `router.js` | Clase `Router`: hash → `fetch` del parcial → `innerHTML` → controlador → *cleanup*. |

### 6.2 `adapters/` — la puerta a datos

Los **7 adapters** son la única capa que conoce la API de Supabase. Traducen las operaciones de
negocio a llamadas `.from(tabla).insert/update/delete/select` y a `supabase.auth.*`.

Responsabilidades:

- Construir las consultas y los `select` de columnas.
- Normalizar los datos de entrada (tipos, longitudes, valores por defecto).
- Traducir el error de PostgREST al contrato `{ ok, error }`.
- Resolver la identidad del usuario cuando la operación la necesita.

| Adapter | Tablas que toca |
|---|---|
| `AuthAdapter` | `auth.users` (vía `supabase.auth`) |
| `UserAdapter` | `USUARIO`, `USUARIO_ROL`, `ROL`, `CLIENTE`, `PERSONA` |
| `ProductAdapter` | `PRODUCTO`, `PRODUCTO_PUBLICO`, `UNIDAD_MEDIDA` |
| `CategoryAdapter` | `CATEGORIA_PRODUCTO`, `PRODUCTO` (para contar antes de borrar) |
| `OrderAdapter` | `PEDIDO`, `DETALLE_PEDIDO`, `TIPO_ATENCION` |
| `ReservationAdapter` | `RESERVA`, `USUARIO`, `MESA` |
| `MessageAdapter` | `MENSAJE`, `USUARIO` |

### 6.3 `services/` — reglas de negocio

Los **7 services** traducen la jerga del negocio a llamadas al adapter. Son el contrato que las
vistas consumen.

```js
// service
async function crearPedido(productos, total) {
    const resultado = await OrderAdapter.crearPedido(productos, total)
    return resultado.ok ? { ok: true, data: resultado.data }
                        : { ok: false, error: "No se pudo registrar el pedido" }
}

// adapter
async function crearPedido(productos, total) { /* ... */ return { ok, data, error } }
```

La diferencia: el service **traduce el mensaje de error técnico a un mensaje presentable** y
decide qué se expone hacia la vista. Es la frontera donde el vocabulario de la base de datos
(`23503`, `violates foreign key`) se convierte en lenguaje de usuario.

**Contrato uniforme.** Toda función de capa media devuelve `{ ok: true, data }` o
`{ ok: false, error }`. Nunca lanza. Esto permite que las vistas hagan `if (!resultado.ok)` sin
`try/catch`, y que el error se muestre siempre con el mismo tratamiento.

### 6.4 `controllers/` — puntos de entrada

Un controller por página HTML. Es el único lugar que crea el `Router`, y por tanto el único que
conoce las URL de la aplicación.

| Controller | Página | Rutas |
|---|---|---|
| `landing.js` | `index.html` | `/`, `/menu`, `/reservas`, `/contacto`, `/nosotros` |
| `auth.js` | `auth.html` | `/login`, `/register` |
| `dashboard.js` | `dashboard.html` | `/dashboard` + 9 subsecciones |
| `carrito.js` | (global) | — drawer que se auto-inicializa al importarse |

`dashboard.js` hace además el montaje del `Sidebar` y el `Topbar`, resuelve la sesión antes de
arrancar el router y define los títulos por ruta.

### 6.5 `views/` — controladores de vista

**20 archivos.** Uno por ruta. Cada controlador recibe el nodo contenedor ya populado por el
router, se engancha a sus eventos, dibuja y devuelve una función de limpieza.

| Subcarpeta | Vistas |
|---|---|
| `landing/` | `home`, `menu`, `reservas`, `contacto`, `nosotros` |
| `auth/` | `login`, `register` |
| `dashboard/` | `panel`, `carta`, `categorias`, `pedidos`, `reservas`, `mensajes`, `usuarios`, `mis-pedidos`, `mis-reservas`, `mis-mensajes`, `crud-comun`, `mis-comun` |

Dos archivos son utilidades compartidas: `crud-comun.js` agrupa las piezas que repiten los CRUD
del panel (pintado de tabla, confirmación de borrado) y `mis-comun.js` lo mismo para las vistas de
cliente.

### 6.6 `components/` — UI reutilizable

**9 componentes**, todos agnósticos del dominio: no saben si muestran un producto o un mensaje.

`Icon.js` merece mención aparte: es la **fábrica única de iconos**. Expone `icon(nombre)`
(elemento del DOM) e `icono(nombre)` (string, para plantillas), y traduce los nombres del proyecto
a los de Reicon, que se carga como web component en modo `Filled`. Ninguna vista dibuja SVG a mano
y no existe ni un emoji en el código.

### 6.7 `session/` — control de acceso

| Archivo | Función |
|---|---|
| `guard.js` | Exige sesión. Si no hay, redirige a `/auth.html?redirect=…` conservando el destino. Se auto-invoca al importarse. |
| `roleGuard.js` | Exige uno de los roles indicados. Si no, redirige a `auth.html` o al panel. |
| `opcionalSesion.js` | Devuelve la sesión o `null`, **sin** redirigir. Para contenido público con sesión opcional. |

`ROLES_EMPEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]` es la constante que separa a la plantilla de
personal de la de cliente.

### 6.8 `utils/` — utilidades

`format.js` (fechas en locale `es-PE`, moneda en soles, escape de HTML) y `notify.js` (fachada de
`notifySuccess` / `notifyError` / `notifyWarning` sobre `Notification.js`).

> El escape de HTML vive aquí y se usa de forma sistemática en todas las plantillas. Toda
> interpolación de dato en un `innerHTML` pasa por `escaparHTML()`. Es lo que impide que un
> producto con nombre malicioso se convierta en XSS.

### 6.9 La regla hexagonal

**Solo `js/adapters/` importa `supabaseClient.js`.**

El proyecto aplica una arquitectura hexagonal (puertos y adaptadores) en la que el dominio —los
services y las vistas— no sabe nada del transporte:

```
    ┌─────────────────────────────────────────────┐
    │  services/  ·  views/  ·  controllers/      │   No conocen Supabase.
    │  Dominio: reglas de negocio y presentación  │   Cambiar de base de datos
    └───────────────────┬─────────────────────────┘   no toca nada de arriba.
                        │
    ┌───────────────────▼─────────────────────────┐
    │  adapters/                                 │   Puerto: define la interfaz
    │  AuthAdapter, OrderAdapter, ...            │   que el dominio necesita.
    └───────────────────┬─────────────────────────┘
                        │  implements
    ┌───────────────────▼─────────────────────────┐
    │  lib/supabaseClient.js                     │   Adaptador: habla PostgREST
    │  supabase-js                               │   y GoTrue.
    └─────────────────────────────────────────────┘
```

**Regla verificada:** los 7 archivos de `js/adapters/` son los únicos que importan
`supabaseClient.js`. Ningún service, vista, componente o utility lo hace. Y en la base de datos,
la lógica de negocio se apoya en funciones `security definer` y en RLS —que se ejecutan en el
motor— en lugar de en reglas repartidas en el cliente.

**Qué aporta en la práctica:**

1. **Un solo punto de contacto con la base de datos.** Localizar una consulta es buscar
   `.from(` dentro de `adapters/`.
2. **El dominio es testeable sin base de datos.** Un service se puede probar con un adapter falso
   porque no importa nada de Supabase.
3. **Cambio de backend acotado.** Sustituir Supabase por otro proveedor significa reescribir
   `adapters/` y `supabaseClient.js`. Las 40 vistas y services no se tocan.
4. **La seguridad no depende del frontend.** El RLS evalúa el rol en el servidor. Que el cliente
   no pueda saltarse una regla no depende de que el cliente la respete.

---

## 7. Flujos principales

### 7.1 Registro

```
views/auth/register.js
        │
        ▼  authService.registro(nombre, email, password)
AuthAdapter.signUp(email, password, nombre)
        │
        ▼  supabase.auth.signUp({ email, password, options:{ data:{ nombre } } })
    ───────────────────────────────  Supabase Auth (GoTrue)
                                      crea la fila en auth.users
                                              │
                                              ▼  TRIGGER en auth.users
                                   fn_handle_new_user()  (SECURITY DEFINER)
                                              │
                 ┌────────────────────────────┼────────────────────────────┐
                 ▼                            ▼                            ▼
           PERSONA                     CLIENTE                     USUARIO
     ID_TipoIdentidad=DNI        ID_Persona,              ID_TipoUsuario=CLIENTE
     N_Documento='P'+uuid        Tipo_Cliente='N'         Logeo=email
     Nombre (metadata o          F_Registro=now()         auth_id=new.id
     prefijo del email)
                 │                            │                            │
                 └────────────────────────────┴────────────┬───────────────┘
                                                              ▼
                                                     USUARIO_ROL
                                              ID_Rol = CLIENTE, Vigente='1'
```

El usuario queda con perfil completo y rol `CLIENTE` sin que el frontend escriba nada. El nombre se
toma de `raw_user_meta_data.nombre` y, si falta, del prefijo del correo. El documento es un
placeholder único derivado del UUID (`'P' || uuid`), que evita colisiones sin exigir DNI real en
el registro público.

**Ningún paso de este flujo pasa por la tabla `PERSONA` desde el cliente.** El alta es
responsabilidad exclusiva del trigger, con permisos de `postgres`.

### 7.2 Login

```
views/auth/login.js
        │
        ├─▶ authService.login(email, password)
        │       └─▶ AuthAdapter.signIn  ──▶  supabase.auth.signInWithPassword(...)
        │                    │
        │                    └──▶ { session, user }  con JWT
        │
        ├─▶ authService.obtenerSesion()  ──▶ AuthAdapter.getSession() ──▶ getSession()
        ├─▶ authService.obtenerPerfil()  ──▶ UserAdapter: USUARIO ⋈ PERSONA por auth.uid()
        └─▶ authService.obtenerRoles()   ──▶ USUARIO_ROL ⋈ ROL
                     │
                     ▼
        ¿Rol ∈ ROLES_EMPLEADO?
             │ sí                    │ no
             ▼                      ▼
   /dashboard.html#/dashboard   /index.html
```

**Control del redirect.** `login.js` valida el parámetro `?redirect=` con `destinoSeguro()`, que
rechaza todo lo que no empiece por `/` y en particular `//` (URL protocol-relista, que el
navegador resuelve como salto a otro host: un *open redirect*) y las barras invertidas `\`.

### 7.3 Crear pedido

```
carrito.js  (drawer, localStorage "rodilla_carrito")
        │  productos: [{ id_producto, cantidad, precio }]
        ▼  orderService.crearPedido(productos, total)
OrderAdapter.crearPedido()
        │
        ├─ 1. resolverSesion()   ──▶ USUARIO por auth_id → ID_Usuario + ID_Cliente
        │       └─ si no hay ID_Cliente: "No tiene un perfil de cliente"
        │
        ├─ 2. resolverTipoAtencion() ──▶ primer TIPO_ATENCION activo
        │       └─ si no hay: "No se encontró el tipo de atención"
        │
        ├─ 3. Numero_Pedido = generarNumeroPedido()   (único)
        │
        └─ 4. HASTA 3 INTENTOS:
                 INSERT PEDIDO  { ID_Cliente, ID_Usuario, ID_TipoAtencion,
                                  Numero_Pedido, N_Comensales:1, Total,
                                  Situacion:'P', USUCRE }
                    │
                    ├─ ¿error de unicidad? ──▶ regenerar correlativo y reintentar
                    ├─ ¿otro error?       ──▶ devolver
                    │
                    └─ INSERT DETALLE_PEDIDO  (uno por producto)
                          { ID_Pedido, ID_Producto, Cantidad, Precio,
                            Descuento:0, Sub_Total, Nota, USUCRE }
```

**Punto de diseño: el total se recalcula en el servidor.** El cliente envía el total para mostrarlo
en el carrito, pero el precio real sale del catálogo; el `PEDIDO` se guarda con la información
completada por la base de datos.

**Sobre laatomicidad.** El pedido y sus líneas son dos `INSERT`. Se compensan uno al otro si el
segundo falla, pero no son una transacción: no se usa `rpc()`. Es una limitación conocida y
deliberada del alcance actual, tolerable porque el segundo insert solo puede fallar por una regla
de negocio ya validada.

### 7.4 Reservar mesa

```
views/landing/reservas.js
        │  { N_Comensales, F_Reserva, Observacion }
        ▼  reservationService.crearReserva(datos)
ReservationAdapter.crear()
        │
        ├─ resolverCliente()  ──▶ USUARIO por auth_id → ID_Cliente
        │       └─ se exige sesión: la reserva es siempre de un cliente identificado
        │
        └─ INSERT RESERVA  { ID_Cliente, N_Comensales, F_Reserva,
                             Situacion:'P', Observacion, USUCRE }
```

La reserva nace sin mesa asignada. El `ID_Mesa` y el `Numero_Mesa` los asigna el personal desde el
panel, que es quien conoce la disponibilidad real en el momento. `Situacion` recorre
`P` → `C` (confirmada) → `X` (cancelada).

### 7.5 Enviar mensaje

```
views/landing/contacto.js
        │  { Asunto, Mensaje }
        ▼  messageService.enviarMensaje(datos)
MessageAdapter.crear()
        │
        ├─ resolverCliente()  ──▶ USUARIO por auth_id → ID_Cliente
        │
        └─ INSERT MENSAJE  { ID_Cliente, Asunto, Mensaje,
                             Situacion:'P', F_Envio, USUCRE }
```

El mensaje se guarda con estado pendiente. El personal lo ve en `/dashboard/mensajes`, lo marca
como atendido o lo responde. El cliente consulta el estado en `mis-mensajes`. Es un buzón de
ida y vuelta con trazabilidad, no un simple formulario de contacto.

### 7.6 CRUD de productos (`/dashboard/carta`)

```
views/dashboard/carta.js
        │
        ├── LISTAR (admin) ─▶ productService.listarProductosAdmin()
        │                         └─▶ ProductAdapter.listarAdmin()
        │                              └─▶ FROM PRODUCTO          ← costo y stock
        │
        ├── LISTAR (público) ▶ productService.listarProductos()
        │                         └─▶ ProductAdapter.listar()
        │                              └─▶ FROM PRODUCTO_PUBLICO  ← sin datos internos
        │
        ├── CREAR ─▶ ProductAdapter.crear(datos)
        │             └─ payload normalizado: 15 campos, tipos forzados,
        │                USUCRE truncado a 30 caracteres
        │             └─ INSERT PRODUCTO → SELECT → maybeSingle()
        │
        ├── ACTUALIZAR ─▶ ProductAdapter.actualizar(id, datos)
        │                  └─ UPDATE parcial: solo los campos enviados
        │                     + USUMOD, FECMOD
        │
        └── ELIMINAR ─▶ ProductAdapter.eliminar(id)
                          └─ DELETE WHERE ID_Producto
```

**Decisión de diseño en `actualizar()`.** El update es **parcial a propósito**: se construye el
payload campo a campo con el patrón `if (datos.X !== undefined)`. Un update con el payload
completo de `crear` pondría `Costo` y `Stock` en 0 y violaría el check `CK_PRODUCTO_COSTO`
(`Costo <= Precio`) al bajar el precio de un producto ya cargado.

**Doble lectura, por diseño.** El menú público lee de la vista; el panel lee de la tabla base para
poder ver costo y stock, que el admin necesita para calcular margen y avisar de stock bajo. La
separación está garantizada por RLS, no por la UI.

### 7.7 CRUD de categorías (`/dashboard/categorias`)

```
views/dashboard/categorias.js
        │
        ├── LISTAR ─▶ CategoryAdapter.listar() ─▶ FROM CATEGORIA_PRODUCTO
        ├── CREAR  ─▶ CategoryAdapter.crear(datos) ─▶ INSERT
        ├── EDITAR ─▶ CategoryAdapter.actualizar(id, datos) ─▶ UPDATE
        └── BORRAR ─▶ CategoryAdapter.eliminar(id)
                      │
                      ├─ 1. COUNT(*) FROM PRODUCTO WHERE ID_CategoriaProducto = id
                      │      └─ si hay productos: no se borra, se avisa
                      └─ 2. DELETE FROM CATEGORIA_PRODUCTO WHERE ID_CategoriaProducto = id
```

El borrado está **prevalidado en la aplicación**, pero la base de datos sigue siendo la autoridad:
aunque la cuenta no se hiciera, el `DELETE` fallaría con el error `23503` de la clave foránea
`FK_PRODUCTO_CATEGORIA`. La prevalidación existe para dar un mensaje comprensible, no para hacer
seguro el borrado.

Igual que en productos, las categorías no tienen un campo de área editable desde la UI: el
`Area_Preparacion` se asigna en la creación y define la pestaña del menú.

---

## 8. Despliegue

### 8.1 Vercel

El proyecto se despliega como sitio estático en `https://rodillacafe.vercel.app`.

**`.vercelignore`** — evita que archivos de desarrollo lleguen al artefacto:

```
sql/                      ← el esquema nunca se despliega
work/                     ← las pruebas manuales tampoco
.git/  .gitignore
*.md  *.code-workspace
firebase.json  .firebaserc  firebase-debug.log
node_modules/
.env  .env.local
```

Excluir `sql/` no es cosmético: los scripts contienen la estructura completa de la base de datos,
los *seed* con datos de ejemplo y el bootstrap del administrador. Publicarlos por HTTP los haría
descargables por cualquiera.

**`vercel.json`** — configuración del proyecto:

| Clave | Valor | Efecto |
|---|---|---|
| `cleanUrls` | `true` | `/auth` sirve `auth.html`; la URL pública no lleva extensión. |
| `trailingSlash` | `false` | Evita el redirect en `/ruta/`. |
| `headers` | 4 reglas | Ver tabla siguiente. |

| Patrón | Cabeceras |
|---|---|
| `.(avif\|jpg\|jpeg\|png\|svg\|webp\|woff\|woff2)` | `Cache-Control: public, max-age=31536000, immutable` |
| `.(css\|js)` | `Cache-Control: public, max-age=3600, must-revalidate` |
| `/manifest.webmanifest` | `Content-Type: application/manifest+json` + `max-age=86400` |
| `/(.*)` | `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` |

Las tres cabeceras de seguridad son las básicas de una respuesta HTTP y se aplican a todas las respuestas: impiden
*sniffing* de tipo de contenido, bloquean el *clickjacking* en un `iframe` y limitan qué
referentes salen del navegador.

> **`cleanUrls` y las rutas con hash.** El router es hash-based, así que la URL que el navegador
> pide al servidor es siempre `dashboard.html`; el fragmento nunca viaja. Por eso **no hace falta
> ningún bloque `rewrites`**: la configuración de Vercel se reduce a cabeceras y *clean URLs*.

> **Orden de despliegue de los scripts SQL.** El esquema no se despliega con el frontend, se
> aplica a mano en el SQL Editor de Supabase, **en orden numérico**. Los archivos `018_fixes.sql` y
> `018_link_admin.sql` comparten prefijo y se aplican en ese orden.

### 8.2 Supabase

| Parámetro | Valor |
|---|---|
| Proyecto | `zmksxwgikagorgyeyhli` |
| URL | `https://zmksxwgikagorgyeyhli.supabase.co` |
| Clave | *publishable key* (`sb_publishable_…`), embebida en `js/lib/supabaseClient.js` |
| SDK | `https://esm.sh/@supabase/supabase-js@2` (módulo ES, sin build) |
| Auth | Email + contraseña (GoTrue) |

Se usa una **clave publicable** y no la `service_role`: el frontend nunca habla con la base de
datos como servicio privilegiado, sino como usuario final. Por eso **todas las operaciones están
sujetas a RLS**, y por eso cada operación sensible necesita una política que la autorice
explícitamente.

#### URLs de redirección de Auth

Configurar en *Supabase → Authentication → URL Configuration*:

| Entorno | Site URL | Redirect URLs |
|---|---|---|
| Producción | `https://rodillacafe.vercel.app` | `https://rodillacafe.vercel.app/**` |
| Local | `http://localhost:8000` | `http://localhost:8000/**` |

> El servidor de desarrollo debe ser un servidor HTTP real (`npx serve`, `python -m http.server`).
> Abrir el proyecto con `file://` bloquea las peticiones `fetch` y ninguna vista carga: es una
> restricción de los navegadores, no del código.

#### Aplicación del esquema

1. Crear el proyecto en Supabase.
2. Ejecutar `sql/001` … `sql/021` en orden en el SQL Editor.
3. Crear el usuario administrador en *Authentication → Users* con el correo
   `admin@rodilla.web.app`.
4. Ejecutar `sql/020_bootstrap_admin.sql`, que vincula el `auth_id` con la fila de `USUARIO`
   correspondiente y le asigna el rol `ADMINISTRADOR`.

### 8.3 Despliegue de la aplicación

| Requisito | Origen |
|---|---|
| `index.html`, `auth.html`, `dashboard.html` | Raíz del repositorio |
| `css/`, `js/`, `views/`, `img/` | Se suben tal cual |
| Reicon | `https://unpkg.com/reicon@1.2.4/cdn/reicon.js`, con `defer` en los 3 HTML |
| supabase-js | `https://esm.sh/@supabase/supabase-js@2` |
| Tipografía | Miranda Sans desde Google Fonts |

**Sin paso de compilación.** No hay `npm install`, ni bundler, ni variables de entorno de build.
Vercel sirve los archivos tal como están en el repositorio. Los únicos recursos externos son el
SDK de Supabase, Reicon y la tipografía, todos por CDN versionado.

---

## Apéndice A — Resumen de cifras

| Concepto | Cantidad |
|---|---|
| Tablas | 41 |
| Tablas con RLS habilitado | 41 (100 %) |
| Vistas | 1 (`PRODUCTO_PUBLICO`) |
| Políticas RLS | 47 |
| Funciones de base de datos | 7 |
| Índices | 61 |
| Scripts SQL | 23 |
| Roles | 4 (ADMINISTRADOR, CAJERO, MOZO, CLIENTE) |
| Páginas HTML raíz | 3 |
| Parciales HTML | 17 |
| Hojas CSS | 11 |
| Módulos JS | 53 |
| Rutas del router | 17 (5 públicas, 2 de acceso, 10 de panel) |
| Dependencias npm | 0 |
| Iconos SVG dibujados a mano | 0 |
| Emojis en el código | 0 |

## Apéndice B — Glosario

| Término | Significado |
|---|---|
| **Adapter** | Capa que traduce operaciones de negocio a llamadas a la API de Supabase. |
| **Service** | Capa que traduce jerga de negocio a llamadas al adapter, y errores técnicos a mensajes de usuario. |
| **Controller** | Punto de entrada de una página; crea el router y monta los componentes de chrome. |
| **View** | Controlador de una ruta concreta dentro de un controller. |
| **Guard** | Función que verifica sesión o rol y redirige si no se cumple. |
| **RLS** | *Row Level Security*. Filtrado de filas y columnas ejecutado por PostgreSQL. |
| **Policy** | Regla de RLS: qué operación se permite y bajo qué condición. |
| **Partial** | Fragmento HTML en `views/` que el router inyecta en el contenedor. |
| **Cleanup** | Función que un controlador devuelve para desregistrar listeners al salir de la vista. |
| **Boleta / Factura** | Comprobantes de ventaelectronicos peruano (SUNAT). |
| **Arqueo** | Cierre de turno de caja: efectivo contado contra el registrado por el sistema. |

# Manual de Programador — Rodilla

**Proyecto:** Rodilla — Sistema Web de Cafetería de Especialidad
**Curso:** UTP 2026-II
**URL de producción:** https://rodillacafe.vercel.app

---

## 1. Resumen arquitectónico

Rodilla es una **aplicación web de una sola página (SPA) sin framework ni bundler**.

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (módulos ES nativos) |
| Backend / BaaS | Supabase (PostgreSQL + Auth + Row Level Security) |
| Hosting | Vercel (sitio estático) |
| Router | Hash-based, propio (`js/lib/router.js`) |
| SDK de datos | `@supabase/supabase-js@2` desde `esm.sh` (CDN, sin `npm install`) |
| Iconos | Reicon (web component, CDN) |
| Tipografía | Google Fonts (Miranda Sans) |
| Analítica | Vercel Web Analytics |

**Cero dependencias npm.** No hay `package.json` con dependencias, no hay `node_modules`, no hay paso de compilación. El navegador ejecuta los módulos ES tal como están en el repositorio.

---

## 2. Estructura de carpetas

```
rodilla-main/
├── index.html              Landing (público)
├── auth.html               Login y registro
├── dashboard.html          Panel administrativo / operativo / cliente
├── manifest.webmanifest    Manifiesto PWA
├── vercel.json             Config de despliegue en Vercel
├── .vercelignore           Exclusiones del artefacto
├── server.py               Servidor local de desarrollo (Python)
├── dev-server.py           Servidor local alternativo
├── css/                    Hojas de estilo (11 archivos)
├── img/                    Imágenes y recursos PWA
├── js/                     Código fuente del frontend
│   ├── controllers/        Puntos de entrada (4)
│   ├── views/              Controladores de vista (20)
│   ├── services/           Reglas de negocio (17)
│   ├── adapters/           Única capa que habla con Supabase (14)
│   ├── lib/                Infraestructura (supabaseClient, router, analytics)
│   ├── components/         Componentes de UI reutilizables (11)
│   ├── session/            Control de acceso y sesión (3)
│   └── utils/              Utilidades (format, notify, supabaseHelpers, ticket)
├── views/                  Partiales HTML inyectados por el router (17)
│   ├── landing/
│   ├── auth/
│   └── dashboard/
├── sql/                    Esquema de base de datos (23 scripts, NO se despliega)
├── supabase/               Edge Functions (DNI/RUC)
├── docs/                   Documentación
├── work/                   Pruebas manuales (NO se despliega)
└── tests/                  Pruebas
```

Regla de dependencia **estricta** (solo hacia abajo, nunca al revés):

```
controllers/   →   views/   →   services/   →   adapters/   →   lib/supabaseClient.js
```

Solo `js/adapters/` importa `js/lib/supabaseClient.js`. Ningún service, vista, controlador o componente habla directamente con Supabase.

---

## 3. Capas del frontend

### 3.1 `js/lib/` — infraestructura

| Archivo | Responsabilidad |
|---------|-----------------|
| `supabaseClient.js` | Instancia única de Supabase (`createClient`). Exporta `supabase`, `comprobarBackend()`, `limpiarSesion()`, `configInvalida`. |
| `router.js` | Clase `Router`: lee `window.location.hash`, hace `fetch()` del partial `views/<vista>.html`, lo inyecta con `innerHTML` en `#app`, invoca el controlador y gestiona el *cleanup*. |
| `analytics.js` | Vercel Web Analytics. Pageviews por ruta hash. API: `iniciarAnalytics()` y `evento(nombre, datos)`. |

### 3.2 `js/adapters/` — puerta a datos

Los adapters traducen operaciones de negocio a llamadas de PostgREST / Auth. Contrato uniforme: toda función devuelve `{ ok: true, data }` o `{ ok: false, error }`. Nunca lanza excepciones.

| Adapter | Tablas / operaciones |
|---------|----------------------|
| `AuthAdapter` | `supabase.auth` (signIn, signUp, signOut, getSession, onAuthChange) |
| `UserAdapter` | `USUARIO`, `USUARIO_ROL`, `ROL`, `CLIENTE`, `PERSONA`, `EMPRESA` |
| `ProductAdapter` | `PRODUCTO`, `PRODUCTO_PUBLICO`, `UNIDAD_MEDIDA` |
| `CategoryAdapter` | `CATEGORIA_PRODUCTO`, `PRODUCTO` |
| `OrderAdapter` | `PEDIDO`, `DETALLE_PEDIDO`, `TIPO_ATENCION` |
| `ReservationAdapter` | `RESERVA`, `USUARIO`, `MESA` |
| `MessageAdapter` | `MENSAJE`, `USUARIO` |
| `CajaAdapter`, `InventarioAdapter`, `VentaAdapter`, `TableAdapter`, `ClientAdapter`, `EmpresaAdapter`, `ReporteAdapter`, `AuthAdapter` | dominio de caja, inventario, ventas, mesas, clientes, empresas, reportes |

### 3.3 `js/services/` — reglas de negocio

Traducen jerga de negocio a llamadas al adapter. Traduce errores técnicos (`23503`, `PGRST...`) a mensajes presentables. Es el contrato que consumen las vistas.

Ejemplo del contrato:
```js
// service
async function login(email, password) {
    const resultado = await AuthAdapter.signIn(email, password)
    if (!resultado.ok) return { ok: false, error: { message: "Correo o contraseña incorrectos" } }
    return { ok: true, data: resultado.data }
}
```

### 3.4 `js/controllers/` — puntos de entrada

Un controller por página HTML. Es el único lugar que instancia el `Router` y conoce las URL de la aplicación.

| Controller | Página | Rutas |
|------------|--------|-------|
| `landing.js` | `index.html` | `/`, `/menu`, `/reservas`, `/contacto`, `/nosotros` |
| `auth.js` | `auth.html` | `/login`, `/register` |
| `dashboard.js` | `dashboard.html` | `/dashboard` + 14 subsecciones |
| `carrito.js` | (global) | Drawer del carrito, se auto-inicializa al importarse |

### 3.5 `js/views/` — controladores de vista

Un archivo por ruta. Cada controlador recibe el nodo contenedor ya poblado por el router, dibuja, se engancha a eventos y **devuelve una función de limpieza** que se ejecuta al salir de la vista (evita fugas de listeners).

Vistas del dashboard: `panel`, `carta`, `categorias`, `pedidos`, `ventas`, `caja`, `inventario`, `reportes`, `mesas`, `reservas`, `mensajes`, `usuarios`, `mis-pedidos`, `mis-reservas`, `mis-mensajes`.

Vistas de landing: `home`, `menu`, `reservas`, `contacto`, `nosotros`.

Vistas de auth: `login`, `register`.

Utilidades compartidas: `crud-comun.js` (pintado de tabla, confirmación de borrado) y `mis-comun.js` (vistas de cliente).

### 3.6 `js/components/` — UI reutilizable

Componentes agnósticos del dominio: `Icon`, `Navbar`, `Footer`, `Sidebar`, `Topbar`, `Modal`, `Card`, `Loading`, `Notification`, `SidebarLanding`, `TopbarLanding`.

`Icon.js` es la fábrica única de iconos (Reicon, modo Filled). Expone `icon(nombre)` (elemento DOM) e `icono(nombre)` (string para plantillas).

### 3.7 `js/session/` — control de acceso

| Archivo | Qué hace |
|---------|----------|
| `guard.js` | `guardSesion()`: exige sesión válida. Si no hay, redirige a `/auth.html?redirect=…`. Vigila inactividad (10 min). Si el backend de Supabase cae, pinta un aviso de conexión en lugar de redirigir en bucle. |
| `roleGuard.js` | `guardRol(rolesPermitidos)`: exige uno de los roles indicados; si no, redirige a `auth.html` o al panel. |
| `opcionalSesion.js` | Devuelve la sesión o `null`, sin redirigir. Para contenido público con sesión opcional. |

### 3.8 `js/utils/` — utilidades

- `format.js`: fechas en locale `es-PE`, moneda en soles (`S/`), escape de HTML (`escaparHTML`).
- `notify.js`: fachada de `notifySuccess` / `notifyError` / `notifyWarning` sobre `Notification.js`.
- `ticket.js`: generación de comprobante/ticket.
- `supabaseHelpers.js`: helpers para Supabase.

---

## 4. Router (hash-based)

El router vive en `js/lib/router.js`. Convierte `#/ruta` en contenido de `views/<ruta>.html`.

Flujo de `navigate(ruta)`:
1. Busca la ruta en la tabla de rutas del controller. Si no existe, cae en `porDefecto`.
2. Limpia la vista anterior (ejecuta su función de cleanup).
3. `fetch()` del partial con `cache: "no-store"` (evita HTML viejo en desarrollo).
4. Inyecta el HTML con `innerHTML` en el contenedor (`#app`).
5. Invoca el controlador de la vista pasándole el nodo. Si devuelve una función, la guarda como cleanup.
6. `scrollIntoView({ block: "start" })`.

Uso típico (desde `dashboard.js`):
```js
const router = new Router({
    rutas: RUTAS,
    contenedor: "#app",
    porDefecto: "/dashboard",
})
router.start()
```

`Router.irA(ruta)` cambia `window.location.hash` para navegar programáticamente.

**Importante:** el router necesita HTTP. Abrir el proyecto con `file://` bloquea los `fetch` de los partials. Usa `python server.py` → `http://localhost:8000`.

---

## 5. Cliente de Supabase

`js/lib/supabaseClient.js` crea una única instancia:

```js
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
```

La URL y la clave pública están en `js/config.js`. Nunca uses la `service_role` desde el frontend: todas las operaciones van sujetas a RLS.

Utilidades exportadas:
- `comprobarBackend()`: sonda `/auth/v1/health` con 6 s de timeout. Devuelve `{ ok }` o `{ ok: false, motivo, detalle }` donde motivo es `config`, `http` o `red`.
- `limpiarSesion()`: borra la sesión persistida sin hacer petición de red (útil cuando el backend está caído).

---

## 6. Sesión y guards

### 6.1 `guardSesion()`
Se llama al inicio de páginas protegidas. Hace:
1. Sonda al backend (`comprobarBackend`). Si falla, limpia la sesión y pinta aviso de conexión.
2. `obtenerSesion()`. Si no hay sesión, redirige a `/auth.html?redirect=…`.
3. Si está en página pública y tiene sesión, redirige al home.
4. Registra actividad y comprueba el límite de inactividad (10 min). Si expiró, cierra sesión y redirige al login.
5. Inicia la vigilancia de inactividad (listeners de pointer/teclado/scroll + intervalo de 10 s).

Devuelve la sesión o `null` (si devolvió null, el caller ya no sigue).

### 6.2 `roleGuard(rolesPermitidos)`
Valida sesión, expiración de inactividad y que el usuario tenga uno de los roles permitidos (consulta `userService.obtenerRoles()`). Devuelve los roles o `null`.

### 6.3 Inactividad
Límite fijo de 10 minutos (`LIMITE_INACTIVIDAD_MIN = 10`), no configurable por el usuario. Cada interacción (pointer, teclado, scroll, tactil) renueva la marca en `localStorage`. Al expirar, cierra sesión y redirige al login conservando el destino.

---

## 7. Modelo de base de datos (resumen)

Supabase PostgreSQL con **41 tablas**, 1 vista (`PRODUCTO_PUBLICO`), 47 políticas RLS, 61 índices, 3 triggers, 4 funciones de autorización y 9 procedimientos `usp_*`.

Convenciones:
- Nombres en `SCREAMING_SNAKE_CASE`, en español.
- Columnas de auditoría en todas las tablas: `USUCRE`, `PCCRE`, `FECCRE`, `USUMOD`, `PCMOD`, `FECMOD`, `ESTADO`.
- Claves primarias tipo `identity`.
- `auth_id` (UUID) en `USUARIO` es el puente con `auth.users` de Supabase Auth.

Dominios principales:
- **Geografía:** `DEPARTAMENTO`, `PROVINCIA`, `DISTRITO`.
- **Personas:** `TIPO_IDENTIDAD`, `PERSONA`, `EMPRESA`, `CLIENTE`.
- **RRHH:** `CARGO`, `CONTRATO`, `EMPLEADO`.
- **Seguridad:** `TIPO_USUARIO`, `USUARIO`, `MODULO`, `ROL`, `PERMISO`, `ROL_PERMISO`, `USUARIO_ROL`, `AUDITORIA`.
- **Catálogo:** `UNIDAD_MEDIDA`, `CATEGORIA_PRODUCTO`, `PRODUCTO`.
- **Salón:** `ZONA`, `ESTADO_MESA`, `MESA`, `TIPO_ATENCION`.
- **Pago:** `METODO_PAGO`, `SERIE_COMPROBANTE`.
- **Caja:** `CAJA`, `APERTURA_CAJA`, `TIPO_MOVIMIENTO_CAJA`, `CONCEPTO_CAJA`, `MOVIMIENTO_CAJA`.
- **Ventas:** `PEDIDO`, `DETALLE_PEDIDO`, `VENTA`, `DETALLE_VENTA`, `BOLETA`, `FACTURA`, `PAGO_VENTA`.
- **Rodilla (propios):** `RESERVA`, `MENSAJE`.

Roles: `ADMINISTRADOR` (nivel 1), `CAJERO` (2), `MOZO` (3), `CLIENTE` (4).

---

## 8. Seguridad (RLS)

Todas las 41 tablas tienen RLS habilitado (100 %). Las políticas siguen la convención `p_<abreviatura>_<acción>_<sujeto>`.

| Patrón | Significado |
|--------|-------------|
| `p_*_select_all` | Lectura pública (`using (true)`). |
| `p_*_admin_all` | Acceso completo solo para `ADMINISTRADOR` (`is_admin()`). |
| `p_*_select_own_or_admin` | Dueño del registro o admin (`is_owner_cliente(...) or is_admin()`). |
| `p_*_update_own_or_admin` | Igual para escritura. |
| `p_mesa_operativo_update` | `CAJERO` o `MOZO` actualizan estado de mesas (`is_operativo()`). |

Funciones de apoyo (`security definer`, `stable`, `search_path = public`):
- `is_admin()`, `is_rol(text)`, `is_operativo()`, `is_owner_cliente(int)`.

**Casos notables:**
- `PRODUCTO`: la tabla base está cerrada al público. El menú lee de la vista `PRODUCTO_PUBLICO` (8 columnas, `ESTADO = '1'`). El admin lee de la tabla completa para ver costo y stock.
- Trigger `fn_handle_new_user()`: al registrarse en Supabase Auth, crea automáticamente `PERSONA` + `CLIENTE` + `USUARIO` + `USUARIO_ROL` (rol `CLIENTE`).
- Trigger `fn_usuario_proteger_cols()`: impide auto-elevación de privilegios.
- Trigger `fn_tr_movimiento_caja_acumula()`: acumula totales de caja.

---

## 9. Flujos principales (código)

### 9.1 Registro de cliente
```
views/auth/register.js
  → authService.registro(nombre, email, password)
    → AuthAdapter.signUp(email, password, nombre)
      → supabase.auth.signUp({ email, password, options: { data: { nombre } } })
        → Supabase Auth crea auth.users
          → TRIGGER fn_handle_new_user() (security definer)
            → PERSONA + CLIENTE + USUARIO + USUARIO_ROL (rol CLIENTE)
```

### 9.2 Login
```
views/auth/login.js
  → authService.login(email, password)
    → AuthAdapter.signIn → supabase.auth.signInWithPassword
  → authService.obtenerSesión() → AuthAdapter.getSession()
  → authService.obtenerPerfil() → UserAdapter (USUARIO ⋈ PERSONA por auth.uid())
  → authService.obtenerRoles() → USUARIO_ROL ⋈ ROL
  → rol ∈ [ADMINISTRADOR, CAJERO, MOZO] ? dashboard.html : index.html
```

El parámetro `?redirect=` se valida con `destinoSeguro()` (rechaza open redirects tipo `//` o `\`).

### 9.3 Crear pedido (carrito)
```
carrito.js (localStorage "rodilla_carrito")
  → orderService.crearPedido(productos, total)
    → OrderAdapter.crearPedido()
      1. resolverSesion() → USUARIO por auth_id → ID_Usuario + ID_Cliente
      2. resolverTipoAtención() → primer TIPO_ATENCION activo
      3. Numero_Pedido = generarNumeroPedido() (único, reintenta si colisión)
      4. INSERT PEDIDO (Situacion: 'P') + INSERT DETALLE_PEDIDO (uno por producto)
```

El total se recalcula en el servidor desde el catálogo; el cliente solo envía un total de referencia. El pedido y sus detalles son dos INSERT (no transacción única, limitación conocida y deliberada).

### 9.4 Reserva de mesa
```
views/landing/reservas.js
  → reservationService.crearReserva({ N_Comensales, F_Reserva, Observacion })
    → ReservationAdapter.crear()
      → resolverCliente() (exige sesión)
      → INSERT RESERVA (Situacion: 'P', sin mesa asignada)
```
La mesa se asigna desde el panel (`/dashboard/reservas`).

### 9.5 Mensaje de contacto
```
views/landing/contacto.js
  → messageService.enviarMensaje({ Asunto, Mensaje })
    → MessageAdapter.crear()
      → resolverCliente()
      → INSERT MENSAJE (Situacion: 'P')
```

### 9.6 CRUD de productos (`/dashboard/carta`)
- `listarProductosAdmin()` → `ProductAdapter.listarAdmin()` → `FROM PRODUCTO` (costo y stock incluidos).
- `listarProductos()` → `ProductAdapter.listar()` → `FROM PRODUCTO_PUBLICO` (sin datos internos).
- `crear(datos)` → payload normalizado (15 campos, tipos forzados, `USUCRE` truncado a 30) → `INSERT PRODUCTO`.
- `actualizar(id, datos)` → **update parcial**: solo los campos enviados + `USUMOD`, `FECMOD`. Nunca reescribe `Costo`/`Stock` si no se envían.
- `eliminar(id)` → `DELETE WHERE ID_Producto`.

---

## 10. Cómo añadir una nueva funcionalidad

Seguir el orden de capas. Ejemplo: añadir un módulo "Proveedores".

1. **Base de datos:** crear script SQL en `sql/` (número siguiente, p. ej. `023_proveedores.sql`) con tabla, RLS y seed. Aplicar en Supabase SQL Editor.
2. **Adapter:** crear `js/adapters/ProveedorAdapter.js` con `listar`, `crear`, `actualizar`, `eliminar`. Es el único que importa `supabaseClient.js`.
3. **Service:** crear `js/services/proveedorService.js` que llame al adapter y traduzca errores a mensajes de usuario.
4. **Vista HTML:** crear `views/dashboard/proveedores.html` (partial inyectado por el router).
5. **Controlador de vista:** crear `js/views/dashboard/proveedores.js` que reciba el nodo, dibuje, maneje eventos y devuelva cleanup.
6. **Ruta:** agregar la entrada en `js/controllers/dashboard.js` (`RUTAS` y `TITULOS`).
7. **Menú:** si corresponde, agregar ítem en `js/components/Sidebar.js` según rol.
8. **Pruebas:** abrir `http://localhost:8000/dashboard.html#/dashboard/proveedores` y verificar.

---

## 11. Despliegue local

1. Levantar servidor HTTP (requerido por el router):
   ```bash
   python server.py
   # o
   python dev-server.py
   ```
   Sirve en `http://localhost:8000` con Content-Type correcto para módulos ES y reescritura SPA (`/dashboard/*` → `dashboard.html`, `/auth/*` → `auth.html`, resto → `index.html`).

2. Abrir `http://localhost:8000`.

> No abrir con `file://`: los navegadores bloquean `fetch` de archivos locales y los partials no cargan.

### 11.1 Base de datos local para desarrollo

El esquema NO se despliega con el frontend. Se aplica a mano en el SQL Editor de Supabase, **en orden numérico**:

```
001_extensions.sql → 002_geografia.sql → ... → 021_producto_publico.sql → 022_auditoria_usuario_120.sql
```

Luego:
1. Crear el usuario administrador en Supabase → Authentication → Users con correo `admin@rodilla.web.app`.
2. Ejecutar `sql/020_bootstrap_admin.sql` para vincular el `auth_id` y asignar rol `ADMINISTRADOR`.

---

## 12. Despliegue en producción (Vercel)

El sitio se despliega como estático en `https://rodillacafe.vercel.app`. Despliegue automático por push al repositorio vinculado.

- `vercel.json`: `cleanUrls`, `trailingSlash: false`, cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y caché de assets.
- `.vercelignore`: excluye `sql/`, `work/`, `.git/`, `*.md`, `supabase/`, `node_modules/`, `.env`, etc. El esquema de BD nunca sube al despliegue.

### 12.1 Configuración de Supabase Auth

En Supabase → Authentication → URL Configuration:

| Entorno | Site URL | Redirect URLs |
|---------|----------|---------------|
| Producción | `https://rodillacafe.vercel.app` | `https://rodillacafe.vercel.app/**` |
| Local | `http://localhost:8000` | `http://localhost:8000/**` |

### 12.2 Variables de entorno del frontend

Solo `js/config.js`:
```js
export const SUPABASE_URL = "https://<proyecto>.supabase.co"
export const SUPABASE_ANON_KEY = "sb_publishable_..."
```
Son públicas por diseño (publishable key). Nunca poner claves secretas aquí (Factiliza, etc.).

### 12.3 Edge Functions (DNI/RUC)

Las Edge Functions `consultar-dni` y `consultar-ruc` están en `supabase/functions/`. Requieren secrets `FACTILIZA_KEY_1/2/3` configurados en Supabase (Settings → Edge Functions → Secrets). Desplegar con:

```bash
supabase functions deploy consultar-dni
supabase functions deploy consultar-ruc
```

El frontend debe llamarlas vía `supabase.functions.invoke(...)`, no a `api.factiliza.com` directamente.

---

## 13. Convenciones de código

- Módulos ES (`import` / `export`), sin bundler.
- Contrato de servicios/adapters: `{ ok: true, data }` \| `{ ok: false, error }`. Nunca lanzar.
- Todos los interpolados de datos en `innerHTML` pasan por `escaparHTML()` (previene XSS).
- Los controladores de vista devuelven una función de limpieza para desregistrar listeners al navegar.
- Los nombres de BD son `SCREAMING_SNAKE_CASE` en español.
- CSS con tokens de diseño en `css/style.css`; organización en `base/`, `components/`, `pages/`.
- Iconos solo vía `Icon.js` (Reicon). No dibujar SVG a mano, no usar emojis.

---

## 14. Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Las vistas no cargan, consola muestra errores de `fetch` | Abierto con `file://` | Usar `python server.py` → `http://localhost:8000` |
| "No se pudo conectar con el servidor de autenticación" | `SUPABASE_URL` mal escrita o Supabase caído | Revisar `js/config.js`; ejecutar `comprobarBackend()` en consola |
| Login no redirige ni da error | Redirect URL no configurada en Supabase Auth | Añadir `https://rodillacafe.vercel.app/**` en Redirect URLs |
| El menú público no muestra productos | `PRODUCTO_PUBLICO` no creada o RLS revocado | Aplicar `021_producto_publico.sql` después del adapter |
| Sesión se cierra sola a los 10 min | Límite de inactividad (por diseño) | Interactuar con la página o iniciar sesión de nuevo |
| Cambios no se ven en producción | Caché de Vercel / service worker | Esperar el despliegue o hacer hard reload |

---

## 15. Enlaces de referencia

- Repositorio: `C:\Users\david\Downloads\David\prog\rodillacafe`
- Documentación de arquitectura: `docs/ARQUITECTURA.md`
- Auditoría cloud: `AUDITORIA_CLOUD_RODILLA.md`
- Producción: https://rodillacafe.vercel.app

---

*Fin del manual de programador.*
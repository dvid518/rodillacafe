# Explicación Técnica - Dante Guerrero

## 1. Resumen de mi Rol
Yo soy responsable de la autenticación, la gestión de usuarios, la mensajería y la documentación técnica. Mi código gestiona el login y registro con Supabase Auth, crea automáticamente el perfil del usuario al registrarse, protege las rutas según el rol del usuario y documenta la arquitectura y el informe del proyecto.

## 2. ¿Cómo funciona mi código? (Flujo paso a paso)

**Al registrarse un usuario nuevo:**
1. El controlador `js/views/auth/register.js` llama a `authService.registro(nombre, email, password)` (`js/services/authService.js`).
2. El servicio invoca `AuthAdapter.signUp(email, password, nombre)` (`js/adapters/AuthAdapter.js`), que usa `supabase.auth.signUp` para crear la cuenta en `auth.users`.
3. Al insertarse el usuario en `auth.users`, se dispara el trigger `tr_handle_new_user` definido en `sql/013_auth_trigger.sql`, que ejecuta la función `fn_handle_new_user()`.
4. Ese trigger crea automáticamente una fila en `PERSONA`, otra en `CLIENTE` y otra en `USUARIO` (vinculada por `auth_id`), y le asigna el rol `CLIENTE` (`ID_Rol = 4`) en `USUARIO_ROL`. Todo esto sin que el frontend tenga que insertar esas tablas a mano.

**Al iniciar sesión y acceder a rutas protegidas:**
1. El controlador `js/views/auth/login.js` llama a `authService.login(email, password)`, que usa `AuthAdapter.signIn()` para autenticar con Supabase Auth (JWT).
2. Para entrar al módulo de Usuarios (`js/views/dashboard/usuarios.js`), se ejecuta `guardRol(["ADMINISTRADOR"])` en `js/session/roleGuard.js`.
3. `guardRol` verifica la sesión con `authService.obtenerSesion()`, obtiene los roles con `userService.obtenerRoles()`, y si el usuario no tiene el rol permitido lo redirige al login o al index. Solo administradores (y roles de `ROLES_EMPLEADO`) pueden entrar.

**Mensajería y perfil:**
- `messageService.js` y `MessageAdapter.js` gestionan el envío y listado de mensajes (`js/views/dashboard/mensajes.js`, `mis-mensajes.js`).
- `userService.js` y `UserAdapter.js` obtienen el perfil y los roles del usuario autenticado (`obtenerPerfil`, `obtenerRoles`).
- `guard.js` y `opcionalSesion.js` (`js/session/`) controlan el acceso condicional a rutas públicas y privadas.

## 3. ¿Dónde está mi código? (Arquitectura)
Mi código está en la capa de autenticación, sesión, usuarios y documentación:
- `js/adapters/` — `AuthAdapter.js` (signIn, signUp, signOut, getSession), `UserAdapter.js` (getPerfilByAuthId, getRoles), `MessageAdapter.js` (mensajes).
- `js/services/` — `authService.js` (login, registro, logout, obtenerSesion, obtenerPerfil, obtenerRoles), `userService.js`, `messageService.js`.
- `js/views/auth/` — `login.js`, `register.js`. Vistas del dashboard: `usuarios.js`, `mensajes.js`.
- `js/session/` — `guard.js`, `roleGuard.js` (función `guardRol` y `ROLES_EMPLEADO`), `opcionalSesion.js`.
- `sql/013_auth_trigger.sql` — trigger y función que crean PERSONA + CLIENTE + USUARIO tras el registro.
- `sql/014_rls_policies.sql` — políticas RLS que complementan la protección de datos de usuarios.
- `docs/` — `INFORME_DATA.md`, `ARQUITECTURA.md`, `GUION_SUSTENTACION.md`.

Se conecta con el resto del sistema así: yo proveo la identidad del usuario (quién es y qué rol tiene) que todos los demás módulos (ventas, pedidos, caja, clientes) necesitan para autorizar acciones y filtrar datos.

## 4. Preguntas frecuentes del profesor (y sus respuestas)

**P1: ¿Cómo evitas que un cliente común acceda a la ruta de Usuarios (admin)?**
R: Con `guardRol()` en `js/session/roleGuard.js`. Verifica la sesión y los roles del usuario; si el rol no está en la lista permitida (por ejemplo `["ADMINISTRADOR"]`), redirige al login o al index y bloquea el acceso. Se complementa con las políticas RLS del servidor (`sql/014_rls_policies.sql`).

**P2: ¿Qué pasa cuando un usuario se registra: se crea solo en auth.users o también en las tablas propias?**
R: Se crea en `auth.users` vía Supabase Auth, y el trigger `tr_handle_new_user` (`sql/013_auth_trigger.sql`) crea automáticamente su perfil en `PERSONA`, `CLIENTE` y `USUARIO`, asignándole el rol `CLIENTE`. El frontend no debe insertar esas filas manualmente.

**P3: ¿Cómo proteges las credenciales de Supabase Auth en el frontend?**
R: Supabase Auth maneja el JWT y la sesión internamente; el frontend solo llama a `AuthAdapter.signIn` / `signUp` y recibe el token de sesión, que se valida en cada petición mediante `authService.obtenerSesion()`. La clave secreta de Supabase nunca se expone en el navegador.

## 5. Conceptos clave que debo dominar
1. **Supabase Auth / JWT** — autenticación y manejo de sesiones con token web.
2. **Trigger de base de datos (fn_handle_new_user)** — función PostgreSQL que crea PERSONA/CLIENTE/USUARIO tras registrar en auth.users.
3. **Guard de rutas (guardRol / roleGuard)** — protección de vistas por rol en el frontend.
4. **Row Level Security (RLS)** — políticas de seguridad a nivel de fila que complementan el control de acceso.
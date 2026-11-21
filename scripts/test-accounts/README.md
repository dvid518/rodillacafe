# Scripts de cuentas de prueba — Fase D (Rodilla)

## Archivos

| Archivo | Propósito |
|---------|-----------|
| `.env.example` | Plantilla de variables de entorno (sin secretos) |
| `consultar-roles.mjs` | Consulta roles, permisos, usuarios y cuentas de prueba existentes |
| `crear-cuentas-prueba.mjs` | Crea una cuenta de prueba por cada rol (ADMINISTRADOR, CAJERO, MOZO, CLIENTE) |
| `verificar-asignaciones.mjs` | Verifica roles y permisos asignados a cada cuenta de prueba |

## Requisitos previos

1. Acceso al panel de Supabase del proyecto `zmksxwgikagorgyeyhli`.
2. La **Service Role Key** del proyecto (Panel de Supabase → Settings → API → service_role).
3. Node.js instalado (para ejecutar los scripts `.mjs`).

## Configuración

```bash
cp scripts/test-accounts/.env.example scripts/test-accounts/.env
```

Editar `scripts/test-accounts/.env` y rellenar `SUPABASE_SERVICE_ROLE_KEY` con la clave real.

**Nunca subir `.env` al repositorio. Nunca incluir la Service Role Key en el frontend.**

## Ejecución

### 1. Consultar estado actual
```bash
node scripts/test-accounts/consultar-roles.mjs
```
Muestra roles, permisos, matriz ROL→PERMISO, usuarios existentes y cuentas de prueba identificadas.

### 2. Crear cuentas de prueba
```bash
node scripts/test-accounts/crear-cuentas-prueba.mjs
```
Crea una cuenta por rol con correos `prueba-{rol}@rodilla.test`. Es idempotente: si se ejecuta varias veces no duplica cuentas.

### 3. Verificar asignaciones
```bash
node scripts/test-accounts/verificar-asignaciones.mjs
```
Comprueba que cada cuenta tiene el rol correcto asignado y lista sus permisos.

## Pruebas posteriores (manuales, con las cuentas creadas)

| Prueba | Qué verificar |
|--------|---------------|
| Inicio de sesión | Cada cuenta puede hacer login con su correo y contraseña |
| Rutas permitidas | Cada rol accede a sus módulos autorizados en el dashboard |
| Operaciones permitidas | Admin gestiona usuarios; cajero registra ventas y abre caja; mozo registra pedidos |
| Operaciones prohibidas | Mozo no accede a caja; cliente no accede a usuarios |
| RLS | Lecturas y escrituras respetan las políticas de cada rol |
| No duplicación | Volver a ejecutar `crear-cuentas-prueba.mjs` no duplica cuentas |
| Usuarios reales intactos | Los usuarios preexistentes no se modificaron |

## Contraseñas

Las cuentas se crean con contraseñas definidas en `crear-cuentas-prueba.mjs` (no se revelan en este informe). Para cambiar una contraseña, usar el panel de Supabase Auth o la Admin API.

## Limitaciones

- Los scripts requieren la Service Role Key (variable de entorno).
- La creación de usuarios en Auth dispara el trigger `fn_handle_new_user`, que crea PERSONA + CLIENTE + USUARIO con rol CLIENTE. El script corrige después el rol al deseado.
- No se modifican políticas RLS ni datos de producción.

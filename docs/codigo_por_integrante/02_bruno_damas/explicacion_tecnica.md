# Explicación Técnica - Bruno Damas

## 1. Resumen de mi Rol
Yo soy responsable del frontend y de la lógica del dashboard, especialmente de los módulos de Clientes y Empresas. Mi código conecta la interfaz con los servicios, valida los formularios, evita datos duplicados y optimiza las consultas a la API de Factiliza usando una caché local en la tabla PERSONA.

## 2. ¿Cómo funciona mi código? (Flujo paso a paso)

**Al buscar o crear un cliente por DNI:**
1. El usuario abre el módulo Clientes (`js/views/dashboard/clientes.js`) e ingresa un DNI en el formulario.
2. El controlador llama a `clientService.crearCliente(datos)` (`js/services/clientService.js`).
3. El servicio consulta primero la tabla `PERSONA` (a través de `ClientAdapter.listarPersonas()` / `listarEmpresas()`) para ver si esa persona ya existe y evitar duplicados.
4. Si la persona no existe, se invoca la Edge Function `supabase/functions/consultar-dni/index.ts` que consulta Factiliza. Así se usa la API solo cuando es necesario (caché local) y la clave de la API no viaja al navegador.
5. Si todo es válido, `ClientAdapter.crear(datos)` inserta el cliente en la base de datos.

**En el dashboard y la navegación:**
- `clientService` ofrece `listarClientes`, `crearCliente`, `actualizarCliente`, `eliminarCliente`, `listarPersonasDisponibles` y `listarEmpresasDisponibles`.
- `empresaService` hace lo propio para el módulo Empresas (`js/views/dashboard/empresas.js`) usando `EmpresaAdapter`.
- `Sidebar.js` y `Topbar.js` (`js/components/`) construyen la navegación del dashboard; sus estilos están en `sidebar.css` y `topbar.css`.
- `rucService.js` / `dniService.js` encapsulan la lógica de consulta de documentos de identidad.

## 3. ¿Dónde está mi código? (Arquitectura)
Mi código está en la capa de presentación y lógica de frontend:
- `js/adapters/` — `ClientAdapter.js` y `EmpresaAdapter.js`: traducen las peticiones del servicio a llamadas a Supabase (listar, crear, actualizar, eliminar).
- `js/services/` — `clientService.js`, `empresaService.js`, `rucService.js` (y `dniService.js`): contienen la lógica de negocio de clientes/empresas y deciden cuándo consultar la Edge Function de Factiliza.
- `js/views/dashboard/` — `clientes.js` y `empresas.js`: vistas que renderizan tablas y formularios y llaman a los servicios.
- `js/components/` — `Sidebar.js` y `Topbar.js`: componentes de navegación compartidos por todo el dashboard.
- `css/` — `sidebar.css` y `topbar.css`: estilos de la barra lateral y la barra superior.

Se conecta con el resto del sistema así: mis vistas llaman a mis servicios, mis servicios llaman a mis adapters, y los adapters leen/escriben en PostgreSQL y en las Edge Functions de Factiliza. Yo entrego al resto del equipo los datos de clientes y empresas que las ventas y pedidos necesitan.

## 4. Preguntas frecuentes del profesor (y sus respuestas)

**P1: ¿Cómo evitas que se creen clientes duplicados al ingresar un DNI?**
R: Antes de crear, el servicio consulta la tabla `PERSONA` (vía `ClientAdapter.listarPersonas()`) para verificar si ya existe una persona con ese documento. Solo si no existe se consulta la Edge Function de Factiliza y se procede a crear el registro.

**P2: ¿Por qué consultas la tabla PERSONA antes de llamar a Factiliza?**
R: Para optimizar el uso de la API. Si la persona ya está registrada localmente, no se gasta una llamada a Factiliza (caché local), lo que reduce costos y tiempos de respuesta.

**P3: ¿Cómo proteges las credenciales de la API de Factiliza desde el frontend?**
R: El navegador nunca llama directamente a Factiliza. Llama a la Edge Function `supabase/functions/consultar-dni/index.ts`, que corre en el servidor de Supabase y guarda la clave de API en variables de entorno del servidor, fuera del alcance del cliente.

## 5. Conceptos clave que debo dominar
1. **Caché local / consulta previa a BD** — verificar en `PERSONA` antes de llamar a una API externa.
2. **Edge Functions** — funciones de servidor de Supabase que ocultan claves de API.
3. **Validación de formularios** — reglas que impiden datos duplicados y envíos inválidos antes de escribir en la base de datos.
4. **Patrón Adapter — Service** — los adaptadores hablan con Supabase y los servicios orquestan la lógica de negocio.
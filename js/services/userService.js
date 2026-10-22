import { AuthAdapter } from "../adapters/AuthAdapter.js"
import { UserAdapter } from "../adapters/UserAdapter.js"
import { dniService } from "./dniService.js"

async function obtenerPerfilActual() {
    const sesion = await AuthAdapter.getSession()
    if (!sesion.ok) return sesion
    if (!sesion.data) return { ok: false, error: { message: "Sin sesión activa" } }
    return UserAdapter.getPerfilByAuthId(sesion.data.user.id)
}

async function obtenerRoles() {
    const resultado = await UserAdapter.getRoles()
    if (!resultado.ok) return resultado
    return { ok: true, data: resultado.data }
}

async function listarUsuarios() {
    const resultado = await UserAdapter.listarUsuarios()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function promoverAAdmin(email) {
    try {
        const resultado = await UserAdapter.promoverAdmin(email)
        if (!resultado.ok) return { ok: false, error: resultado.error }
        return { ok: true, data: resultado.data }
    } catch (error) {
        return { ok: false, error: { message: error?.message || "Error al promover al usuario" } }
    }
}

async function listarClientes() {
    return UserAdapter.listarClientes()
}

/* ---------------------------------------------------------------
   BÚSQUEDA DE USUARIO POR DNI
   ---------------------------------------------------------------
   1) Se busca el DNI en la base de datos (PERSONA -> CLIENTE -> USUARIO).
   2) Si no está, se consulta al servicio externo de DNI con las claves de
      API en fallback (solo se notifica al usuario si todas fallan).
   3) Los datos devueltos por el DNI (nombres, apellidos) se guardan en BD
      junto con el DNI al dar de alta manualmente.
   --------------------------------------------------------------- */

/**
 * Busca un usuario por DNI en la base de datos.
 * Devuelve { ok: true, data: usuario | null }
 */
async function buscarUsuarioPorDNI(nDocumento) {
    const resultado = await UserAdapter.buscarUsuarioPorDNI(nDocumento)
    if (!resultado.ok) return { ok: false, error: { message: resultado.error?.message || "Error al buscar el DNI" } }
    return { ok: true, data: resultado.data }
}

/**
 * Consulta un DNI al servicio externo con fallback de claves API.
 * Devuelve { ok: true, data: { dni, nombres, apellidoPaterno, apellidoMaterno } }
 * o { ok: false, error: { message, agotadas } } si todas las claves fallan.
 */
async function consultarDNIExterno(nDocumento) {
    return dniService.consultarDNI(nDocumento)
}

/**
 * Da de alta un usuario manualmente:
 * - DNI obligatorio.
 * - Si ya existe en BD, devuelve error con existe: true.
 * - Si no existe, crea PERSONA + CLIENTE + USUARIO + rol CLIENTE.
 */
async function registrarUsuarioManual(datos) {
    const resultado = await UserAdapter.crearUsuarioManual(datos)
    if (!resultado.ok) {
        return { ok: false, error: { message: resultado.error?.message || "No se pudo registrar el usuario", existe: resultado.error.existe } }
    }
    return { ok: true, data: resultado.data }
}

export const userService = {
    obtenerPerfilActual,
    obtenerRoles,
    listarUsuarios,
    listarClientes,
    promoverAAdmin,
    buscarUsuarioPorDNI,
    consultarDNIExterno,
    registrarUsuarioManual,
}

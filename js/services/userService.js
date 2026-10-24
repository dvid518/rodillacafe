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

/* ---------------------------------------------------------------
   BÚSQUEDA Y REGISTRO UNIFICADO POR DNI (con fallback silencioso)
   ---------------------------------------------------------------
   Flujo completo:
     1) Busca el DNI en la base de datos (PERSONA -> CLIENTE -> USUARIO).
        Si existe, devuelve ese usuario (origen: "bd").
     2) Si no existe, consulta el servicio externo de DNI probando las
        claves de API en orden. Una clave que falle se descarta en
        silencio y se prueba la siguiente. El usuario solo se entera si
        TODAS las claves agotan (se devuelve el error; quien llama
        decide qué mostrar).
     3) Si se obtienen datos externos, los devuelve listos para registrar.
        Si se pide `registrarAutomaticamente`, los guarda en BD.
   --------------------------------------------------------------- */

/**
 * @param {string} nDocumento - DNI de 8 dígitos
 * @param {object} [opciones]
 * @param {boolean} [opciones.registrarAutomaticamente=false] - si es true, crea
 *   el usuario en BD con los datos obtenidos del servicio externo
 * @param {object} [opciones.datosAdicionales] - campos extra para el registro
 *   (email, celular, logeo, usucre)
 * @returns {Promise<{ok: true, data, origen: "bd"|"externo", yaExistia: boolean, registrado?: boolean, listoParaRegistrar?: boolean}
 *          | {ok: false, error: {message, agotadas?}}}
 */
async function buscarORegistrarUsuarioPorDNI(nDocumento, opciones = {}) {
    const { registrarAutomaticamente = false, datosAdicionales = {} } = opciones

    const doc = String(nDocumento).trim()
    if (!/^\d{8}$/.test(doc)) {
        return { ok: false, error: { message: "El DNI debe tener 8 dígicos" } }
    }

    // 1) Buscar en la base de datos
    const enBD = await buscarUsuarioPorDNI(doc)
    if (!enBD.ok) {
        return { ok: false, error: { message: enBD.error?.message || "Error al buscar el DNI en la base de datos" } }
    }
    if (enBD.data) {
        return { ok: true, data: enBD.data, origen: "bd", yaExistia: true }
    }

    // 2) Consultar servicio externo con fallback silencioso de claves API
    const consulta = await consultarDNIExterno(doc)
    if (!consulta.ok) {
        return {
            ok: false,
            error: {
                message: consulta.error?.message || "No se pudo consultar el DNI en los servicios externos",
                agotadas: consulta.error.agotadas,
            },
        }
    }

    const d = consulta.data
    const datosParaRegistrar = {
        nDocumento: d.dni,
        nombre: d.nombres || "",
        apPaterno: d.apellidoPaterno || "",
        apMaterno: d.apellidoMaterno || "",
        email: datosAdicionales.email || null,
        celular: datosAdicionales.celular || null,
        logeo: datosAdicionales.logeo || String(d.dni),
        usucre: datosAdicionales.usucre || "WEB",
        ...datosAdicionales,
    }

    // 3) Registrar automáticamente si se pide
    if (registrarAutomaticamente) {
        const registrado = await registrarUsuarioManual(datosParaRegistrar)
        if (!registrado.ok) {
            return {
                ok: false,
                error: { message: registrado.error?.message || "No se pudo registrar el usuario", existe: registrado.error.existe },
            }
        }
        return { ok: true, data: registrado.data, origen: "externo", yaExistia: false, registrado: true }
    }

    return { ok: true, data: datosParaRegistrar, origen: "externo", yaExistia: false, listoParaRegistrar: true }
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
    buscarORegistrarUsuarioPorDNI,
}

import { AuthAdapter } from "../adapters/AuthAdapter.js"
import { UserAdapter } from "../adapters/UserAdapter.js"
import { supabase } from "../lib/supabaseClient.js"
import { dniService } from "./dniService.js"
import { exactDocument, lookupFailure, readActiveDocument, readLookupRow, withLookupDeadline } from "./documentLookup.js"

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

async function promoverACajero(email) {
    try {
        const resultado = await UserAdapter.promoverCajero(email)
        if (!resultado.ok) return { ok: false, error: resultado.error }
        return { ok: true, data: resultado.data }
    } catch (error) {
        return { ok: false, error: { message: error?.message || "Error al promover a cajero" } }
    }
}

async function promoverAMozo(email) {
    try {
        const resultado = await UserAdapter.promoverMozo(email)
        if (!resultado.ok) return { ok: false, error: resultado.error }
        return { ok: true, data: resultado.data }
    } catch (error) {
        return { ok: false, error: { message: error?.message || "Error al promover a mozo" } }
    }
}

async function listarClientes() {
    return UserAdapter.listarClientes()
}

const personaFields = "ID_Persona, N_Documento, Nombre, Ap_Paterno, Ap_Materno, EMAIL, Celular"
const dniInvalido = () => lookupFailure("VALIDATION", "El DNI debe tener 8 dígitos")

async function buscarPersona(doc, signal) {
    const row = await readActiveDocument(supabase, "PERSONA", "N_Documento", personaFields, doc, signal)
    if (!row.ok || row.data === null) return row
    if (exactDocument(row.data?.N_Documento, 8) !== doc || row.data?.ID_Persona == null) {
        return lookupFailure("INVALID_RESPONSE")
    }
    return row
}

async function buscarUsuario(doc, signal) {
    const persona = await buscarPersona(doc, signal)
    if (!persona.ok || persona.data === null) return persona
    const row = await readLookupRow(() => supabase.from("USUARIO")
        .select("ID_Usuario, ID_TipoUsuario, ID_Cliente, auth_id, Logeo, Bloqueado, ESTADO, CLIENTE!inner(ID_Cliente, ID_Persona)")
        .eq("CLIENTE.ID_Persona", persona.data.ID_Persona), signal)
    if (!row.ok || row.data === null) return row
    const cliente = Array.isArray(row.data.CLIENTE) ? row.data.CLIENTE[0] : row.data.CLIENTE
    if (cliente?.ID_Persona == null || String(cliente.ID_Persona) !== String(persona.data.ID_Persona)) {
        return lookupFailure("INVALID_RESPONSE")
    }
    return { ok: true, data: { ...row.data, CLIENTE: [{ ...cliente, PERSONA: [persona.data] }] } }
}

async function buscarUsuarioPorDNI(value) {
    const doc = exactDocument(value, 8)
    if (!doc) return dniInvalido()
    return withLookupDeadline(signal => buscarUsuario(doc, signal))
}

const consultarDNIExterno = dniService.consultarDNI

async function registrarUsuarioManual(datos) {
    const doc = exactDocument(datos?.nDocumento, 8)
    if (!doc) return dniInvalido()
    // Check the DB explicitly before handing off to the adapter's write flow.
    const persona = await withLookupDeadline(signal => buscarPersona(doc, signal))
    if (!persona.ok) return persona
    if (persona.data) return { ok: false, error: { message: "Ya existe una persona con ese DNI", existe: true } }
    try {
        const resultado = await UserAdapter.crearUsuarioManual({ ...datos, nDocumento: doc })
        if (resultado.ok) return resultado
        return { ok: false, error: { message: "No se pudo registrar el usuario", existe: resultado.error?.existe } }
    } catch {
        return lookupFailure("SUPABASE_UNAVAILABLE", "No se pudo registrar el usuario")
    }
}

async function buscarORegistrarUsuarioPorDNI(value, opciones = {}) {
    const { registrarAutomaticamente = false, datosAdicionales = {} } = opciones
    const doc = exactDocument(value, 8)
    if (!doc) return dniInvalido()

    const consulta = await withLookupDeadline(async signal => {
        const enBD = await buscarUsuario(doc, signal)
        if (!enBD.ok) return enBD
        if (enBD.data) return { ...enBD, origen: "bd", yaExistia: true }
        return consultarDNIExterno(doc, signal)
    })
    if (!consulta.ok || consulta.origen === "bd") return consulta

    const d = consulta.data
    const datosParaRegistrar = {
        nombre: d.nombres || "",
        apPaterno: d.apellidoPaterno || "",
        apMaterno: d.apellidoMaterno || "",
        email: d.email || null,
        celular: d.celular || null,
        logeo: doc,
        usucre: "WEB",
        ...datosAdicionales,
        nDocumento: doc,
    }
    if (registrarAutomaticamente) {
        const registrado = await registrarUsuarioManual(datosParaRegistrar)
        if (!registrado.ok) return registrado
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
    promoverACajero,
    promoverAMozo,
    buscarUsuarioPorDNI,
    consultarDNIExterno,
    registrarUsuarioManual,
    buscarORegistrarUsuarioPorDNI,
}

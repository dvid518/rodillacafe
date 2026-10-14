import { TableAdapter } from "../adapters/TableAdapter.js"
import { authService } from "./authService.js"

/* ==========================================================================
   SERVICIO DEL SALÓN
   --------------------------------------------------------------------------
   El service mete entre el controlador y el adapter lo que no es una consulta:
   validacion de lo que llega del formulario y el USUMOD de auditoria, que
   siempre es la sesion activa. El controlador no debería tener que acordarse
   de las dos cosas en cada llamada.
   ========================================================================== */

/** USUMOD de auditoria. Sin sesion (solo en pruebas) degrada a "WEB". */
async function auditor() {
    const sesion = await authService.obtenerSesion()
    const usuario = sesion.ok ? sesion.data?.user : null
    return usuario?.email || "WEB"
}

/** MESA.Numero es varchar(5) en sql/007.sql. */
const RE_NUMERO = /^[A-Za-z0-9]{1,5}$/

function esErrorUnique(error) {
    if (!error) return false
    if (error.code === "23505") return true
    return /duplicate key|violates unique constraint|23505/i.test(error.message || "")
}

function esErrorFK(error) {
    if (!error) return false
    if (error.code === "23503") return true
    return /foreign key|violates foreign key/i.test(error.message || "")
}

/* ---------- lecturas ---------- */

async function listarMesas() {
    const resultado = await TableAdapter.listarMesas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarZonas() {
    const resultado = await TableAdapter.listarZonas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarEstados() {
    const resultado = await TableAdapter.listarEstados()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

/* ---------- mesas ---------- */

function validarMesa(datos) {
    const numero = String(datos.Numero ?? "").trim()
    if (!RE_NUMERO.test(numero)) {
        return { ok: false, error: { message: "El numero de mesa admite hasta 5 letras o digitos" } }
    }
    if (!datos.ID_Zona) return { ok: false, error: { message: "Selecciona la zona de la mesa" } }
    if (!datos.ID_EstadoMesa) return { ok: false, error: { message: "Selecciona el estado de la mesa" } }

    const capacidad = Number(datos.Capacidad)
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50) {
        return { ok: false, error: { message: "La capacidad debe estar entre 1 y 50" } }
    }
    return { ok: true, data: { ...datos, Numero: numero, Capacidad: capacidad } }
}

async function crearMesa(datos) {
    const valido = validarMesa(datos)
    if (!valido.ok) return valido

    const resultado = await TableAdapter.crearMesa({ ...valido.data, USUCRE: await auditor() })
    if (!resultado.ok) {
        if (esErrorUnique(resultado.error)) {
            return { ok: false, error: { message: "Ya hay una mesa con ese numero en esa zona" } }
        }
        return { ok: false, error: resultado.error }
    }
    return { ok: true, data: resultado.data }
}

async function actualizarMesa(id, datos) {
    const valido = validarMesa(datos)
    if (!valido.ok) return valido

    const resultado = await TableAdapter.actualizarMesa(id, { ...valido.data, USUMOD: await auditor() })
    if (!resultado.ok) {
        if (esErrorUnique(resultado.error)) {
            return { ok: false, error: { message: "Ya hay una mesa con ese numero en esa zona" } }
        }
        return { ok: false, error: resultado.error }
    }
    return { ok: true, data: null }
}

/** Lo unico que puede hacer un CAJERO o MOZO: p_mesa_operativo_update. */
async function cambiarEstadoMesa(id, idEstadoMesa) {
    if (!idEstadoMesa) return { ok: false, error: { message: "Selecciona un estado" } }
    const resultado = await TableAdapter.cambiarEstado(id, idEstadoMesa, await auditor())
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

async function eliminarMesa(id, forzar = false) {
    const resultado = await TableAdapter.eliminarMesa(id, { USUMOD: await auditor(), forzar })
    if (!resultado.ok) {
        if (esErrorFK(resultado.error)) {
            return { ok: false, error: { message: "La mesa tiene pedidos o reservas asociados" } }
        }
        return { ok: false, error: resultado.error }
    }
    return { ok: true, data: null }
}

/* ---------- zonas ---------- */

async function crearZona(datos) {
    const nombre = String(datos.N_Zona ?? "").trim()
    if (!nombre) return { ok: false, error: { message: "La zona necesita un nombre" } }

    const resultado = await TableAdapter.crearZona({ ...datos, N_Zona: nombre, USUCRE: await auditor() })
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarZona(id, datos) {
    const nombre = String(datos.N_Zona ?? "").trim()
    if (!nombre) return { ok: false, error: { message: "La zona necesita un nombre" } }

    const resultado = await TableAdapter.actualizarZona(id, { ...datos, N_Zona: nombre, USUMOD: await auditor() })
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

async function eliminarZona(id) {
    const resultado = await TableAdapter.eliminarZona(id)
    if (!resultado.ok) {
        if (esErrorFK(resultado.error)) {
            return { ok: false, error: { message: "La zona tiene pedidos o reservas asociados" } }
        }
        return { ok: false, error: resultado.error }
    }
    return { ok: true, data: null }
}

export const tableService = {
    listarMesas,
    listarZonas,
    listarEstados,
    crearMesa,
    actualizarMesa,
    cambiarEstadoMesa,
    eliminarMesa,
    crearZona,
    actualizarZona,
    eliminarZona,
}
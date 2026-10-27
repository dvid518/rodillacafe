import { ClientAdapter } from "../adapters/ClientAdapter.js"

async function listarClientes() {
    const resultado = await ClientAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function crearCliente(datos) {
    const resultado = await ClientAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarCliente(id, datos) {
    const resultado = await ClientAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function eliminarCliente(id) {
    const resultado = await ClientAdapter.eliminar(id)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

async function listarPersonasDisponibles() {
    const resultado = await ClientAdapter.listarPersonas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarEmpresasDisponibles() {
    const resultado = await ClientAdapter.listarEmpresas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const clientService = {
    listarClientes,
    crearCliente,
    actualizarCliente,
    eliminarCliente,
    listarPersonasDisponibles,
    listarEmpresasDisponibles
}

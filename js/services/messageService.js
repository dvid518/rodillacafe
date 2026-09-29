import { MessageAdapter } from "../adapters/MessageAdapter.js"

async function enviarMensaje(datos) {
    const resultado = await MessageAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarMisMensajes() {
    return MessageAdapter.listarMisMensajes()
}

async function listarTodos() {
    return MessageAdapter.listarTodas()
}

async function actualizarEstado(id, situacion) {
    return MessageAdapter.actualizarEstado(id, situacion)
}

async function eliminarMensaje(id) {
    return MessageAdapter.eliminar(id)
}

async function crearMensajeManual(datos) {
    const resultado = await MessageAdapter.crearManual(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarMensaje(id, datos) {
    const resultado = await MessageAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

export const messageService = {
    enviarMensaje,
    crearMensajeManual,
    listarMisMensajes,
    listarTodos,
    actualizarMensaje,
    actualizarEstado,
    eliminarMensaje,
}
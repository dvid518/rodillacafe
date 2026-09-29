import { OrderAdapter } from "../adapters/OrderAdapter.js"

async function crearPedido(productos, total) {
    const resultado = await OrderAdapter.crearPedido(productos, total)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarMisPedidos() {
    return OrderAdapter.listarMisPedidos()
}

async function listarTodos() {
    return OrderAdapter.listarTodos()
}

async function actualizarEstado(id, situacion) {
    return OrderAdapter.actualizarEstado(id, situacion)
}

async function eliminarPedido(id) {
    return OrderAdapter.eliminar(id)
}

async function listarTiposAtencion() {
    const resultado = await OrderAdapter.listarTipos()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function crearPedidoManual(datos) {
    const resultado = await OrderAdapter.crearManual(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarPedido(id, datos) {
    const resultado = await OrderAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

export const orderService = {
    crearPedido,
    crearPedidoManual,
    listarMisPedidos,
    listarTodos,
    listarTiposAtencion,
    actualizarPedido,
    actualizarEstado,
    eliminarPedido,
}
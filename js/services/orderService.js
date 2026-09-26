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

export const orderService = { crearPedido, listarMisPedidos, listarTodos, actualizarEstado, eliminarPedido }
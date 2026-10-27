import { InventarioAdapter } from "../adapters/InventarioAdapter.js"

async function listarProductos() {
    const resultado = await InventarioAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarBajoStock() {
    const resultado = await InventarioAdapter.listarBajoStock()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function ajustarStock(idProducto, nuevoStock, motivo) {
    const resultado = await InventarioAdapter.ajustarStock(idProducto, nuevoStock, motivo)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const inventarioService = {
    listarProductos,
    listarBajoStock,
    ajustarStock
}

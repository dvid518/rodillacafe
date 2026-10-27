import { VentaAdapter } from "../adapters/VentaAdapter.js"

async function listarVentas() {
    const resultado = await VentaAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function crearVenta(datos) {
    const resultado = await VentaAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function anularVenta(id, motivo) {
    const resultado = await VentaAdapter.anular(id, motivo)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

async function obtenerDetalleVenta(idVenta) {
    const resultado = await VentaAdapter.obtenerDetalle(idVenta)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const ventaService = {
    listarVentas,
    crearVenta,
    anularVenta,
    obtenerDetalleVenta
}

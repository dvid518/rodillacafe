import { ReporteAdapter } from "../adapters/ReporteAdapter.js"

async function ventasPorDia(fechaInicio, fechaFin, estado = "E") {
    const resultado = await ReporteAdapter.ventasPorDia(fechaInicio, fechaFin, estado)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function productosMasVendidos(fechaInicio, fechaFin, limite = 10, estado = "E") {
    const resultado = await ReporteAdapter.productosMasVendidos(fechaInicio, fechaFin, limite, estado)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function ventasPorMetodoPago(fechaInicio, fechaFin, estado = "E") {
    const resultado = await ReporteAdapter.ventasPorMetodoPago(fechaInicio, fechaFin, estado)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function kpis(fechaInicio, fechaFin, estado = "E") {
    const resultado = await ReporteAdapter.kpis(fechaInicio, fechaFin, estado)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const reporteService = {
    ventasPorDia,
    productosMasVendidos,
    ventasPorMetodoPago,
    kpis
}

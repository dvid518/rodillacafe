import { supabase } from "../lib/supabaseClient.js"

async function ventasPorDia(fechaInicio, fechaFin, estado = "E") {
    const { data, error } = await supabase
        .from("VENTA")
        .select("F_Venta, Total, Situacion")
        .eq("Situacion", estado)
        .gte("F_Venta", fechaInicio)
        .lte("F_Venta", fechaFin)
    if (error) return { ok: false, error }

    // Agrupar en JS por día
    const porDia = {}
    ;(data || []).forEach(v => {
        const dia = String(v.F_Venta || "").split("T")[0]
        if (!dia) return
        if (!porDia[dia]) porDia[dia] = { total: 0, cantidad: 0 }
        porDia[dia].total += Number(v.Total || 0)
        porDia[dia].cantidad += 1
    })

    const resultado = Object.entries(porDia)
        .map(([fecha, d]) => ({ fecha, total: d.total, cantidad: d.cantidad }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
    return { ok: true, data: resultado }
}

async function productosMasVendidos(fechaInicio, fechaFin, limite = 10, estado = "E") {
    const { data, error } = await supabase
        .from("DETALLE_VENTA")
        .select(`
            Cantidad, Sub_Total,
            PRODUCTO ( N_Producto ),
            VENTA!inner ( Situacion, F_Venta )
        `)
        .eq("VENTA.Situacion", estado)
        .gte("VENTA.F_Venta", fechaInicio)
        .lte("VENTA.F_Venta", fechaFin)
    if (error) return { ok: false, error }

    const agrupado = {}
    ;(data || []).forEach(d => {
        const nombre = d.PRODUCTO?.[0]?.N_Producto || "Producto"
        if (!agrupado[nombre]) agrupado[nombre] = { cantidad: 0, total: 0 }
        agrupado[nombre].cantidad += Number(d.Cantidad || 0)
        agrupado[nombre].total += Number(d.Sub_Total || 0)
    })

    const resultado = Object.entries(agrupado)
        .map(([nombre, d]) => ({ nombre, cantidad: d.cantidad, total: d.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limite)
    return { ok: true, data: resultado }
}

async function ventasPorMetodoPago(fechaInicio, fechaFin, estado = "E") {
    const { data, error } = await supabase
        .from("PAGO_VENTA")
        .select(`
            Monto,
            METODO_PAGO ( N_MetodoPago ),
            VENTA!inner ( Situacion, F_Venta )
        `)
        .eq("VENTA.Situacion", estado)
        .gte("VENTA.F_Venta", fechaInicio)
        .lte("VENTA.F_Venta", fechaFin)
    if (error) return { ok: false, error }

    const agrupado = {}
    ;(data || []).forEach(d => {
        const metodo = d.METODO_PAGO?.[0]?.N_MetodoPago || "Otro"
        if (!agrupado[metodo]) agrupado[metodo] = { cantidad: 0, total: 0 }
        agrupado[metodo].cantidad += 1
        agrupado[metodo].total += Number(d.Monto || 0)
    })

    const resultado = Object.entries(agrupado)
        .map(([metodo, d]) => ({ metodo, cantidad: d.cantidad, total: d.total }))
        .sort((a, b) => b.total - a.total)
    return { ok: true, data: resultado }
}

async function kpis(fechaInicio, fechaFin, estado = "E") {
    const { data, error } = await supabase
        .from("VENTA")
        .select("Total")
        .eq("Situacion", estado)
        .gte("F_Venta", fechaInicio)
        .lte("F_Venta", fechaFin)
    if (error) return { ok: false, error }

    const total = (data || []).reduce((s, v) => s + Number(v.Total || 0), 0)
    const cantidad = (data || []).length
    const ticketPromedio = cantidad > 0 ? total / cantidad : 0
    return { ok: true, data: { total, cantidad, ticketPromedio } }
}

export const ReporteAdapter = {
    ventasPorDia,
    productosMasVendidos,
    ventasPorMetodoPago,
    kpis
}

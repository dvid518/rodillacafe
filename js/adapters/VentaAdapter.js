import { supabase } from "../lib/supabaseClient.js"

const PERFIL_SELECT = `
    ID_Venta,
    F_Venta,
    TipoDocumento,
    Sub_Total,
    Descuento,
    IGV,
    Total,
    T_Pagado,
    Vuelto,
    Situacion,
    CLIENTE (
        ID_Cliente,
        PERSONA ( Nombre, Ap_Paterno, N_Documento )
    ),
    USUARIO ( ID_Usuario, Logeo ),
    APERTURA_CAJA (
        Numero_Turno,
        CAJA ( N_Caja )
    )
`

async function listar() {
    const { data, error } = await supabase
        .from("VENTA")
        .select(PERFIL_SELECT)
        .order("F_Venta", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function crear(datos) {
    // datos: {
    //   ID_Cliente, ID_AperturaCaja, TipoDocumento, ID_MetodoPago,
    //   productos: [{ ID_Producto, Cantidad, Precio }]
    // }
    const usucol = datos.USUCRE || "WEB"

    // 1) Cabecera de venta (totales en cero, se actualizan despues)
    const { data: venta, error: errVenta } = await supabase
        .from("VENTA")
        .insert({
            ID_Cliente: datos.ID_Cliente || null,
            ID_AperturaCaja: datos.ID_AperturaCaja || null,
            TipoDocumento: datos.TipoDocumento || null,
            ID_MetodoPago: datos.ID_MetodoPago || null,
            Sub_Total: 0,
            Descuento: 0,
            IGV: 0,
            Total: 0,
            T_Pagado: 0,
            Vuelto: 0,
            Situacion: "P",
            USUCRE: usucol,
            ESTADO: "1"
        })
        .select("ID_Venta")
        .maybeSingle()
    if (errVenta) return { ok: false, error: errVenta }

    // 2) Detalle de venta
    const productos = Array.isArray(datos.productos) ? datos.productos : []
    if (!productos.length) {
        await supabase.from("VENTA").delete().eq("ID_Venta", venta.ID_Venta)
        return { ok: false, error: { message: "La venta necesita al menos un producto" } }
    }

    const detalle = productos.map(p => ({
        ID_Venta: venta.ID_Venta,
        ID_Producto: Number(p.ID_Producto),
        Cantidad: Math.max(1, Number(p.Cantidad) || 1),
        Precio: Number(p.Precio) || 0,
        USUCRE: usucol
    }))

    const { error: errDetalle } = await supabase
        .from("DETALLE_VENTA")
        .insert(detalle)
    if (errDetalle) {
        await supabase.from("VENTA").delete().eq("ID_Venta", venta.ID_Venta)
        return { ok: false, error: errDetalle }
    }

    // 3) Totales (Sub_Total / IGV / Total). IGV al 18%.
    const subTotal = detalle.reduce((s, d) => s + d.Cantidad * d.Precio, 0)
    const igv = Number((subTotal * 0.18).toFixed(2))
    const total = Number((subTotal + igv).toFixed(2))

    const { error: errTotal } = await supabase
        .from("VENTA")
        .update({ Sub_Total: subTotal, IGV: igv, Total: total })
        .eq("ID_Venta", venta.ID_Venta)
    if (errTotal) {
        await supabase.from("VENTA").delete().eq("ID_Venta", venta.ID_Venta)
        return { ok: false, error: errTotal }
    }

    // 4) Pago de la venta
    const tPagado = Number(datos.T_Pagado) || total
    const vuelto = Number((tPagado - total).toFixed(2))
    const { error: errPago } = await supabase
        .from("PAGO_VENTA")
        .insert({
            ID_Venta: venta.ID_Venta,
            ID_MetodoPago: datos.ID_MetodoPago || null,
            Monto: tPagado,
            Vuelto: vuelto,
            USUCRE: usucol,
            ESTADO: "1"
        })
    if (errPago) {
        await supabase.from("VENTA").delete().eq("ID_Venta", venta.ID_Venta)
        return { ok: false, error: errPago }
    }

    // 5) Descontar stock si el producto lo controla
    for (const p of productos) {
        const { data: prod } = await supabase
            .from("PRODUCTO")
            .select("Controla_Stock, Stock")
            .eq("ID_Producto", p.ID_Producto)
            .maybeSingle()
        if (prod && prod.Controla_Stock === "1") {
            await supabase
                .from("PRODUCTO")
                .update({ Stock: Number((prod.Stock || 0) - p.Cantidad) })
                .eq("ID_Producto", p.ID_Producto)
        }
    }

    return { ok: true, data: { ...venta, Total: total, Sub_Total: subTotal, IGV: igv } }
}

async function anular(id, motivo) {
    const ahora = new Date().toISOString()
    const { error } = await supabase
        .from("VENTA")
        .update({ Situacion: "X", Observacion: motivo || null, USUMOD: "WEB", FECMOD: ahora })
        .eq("ID_Venta", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

async function obtenerDetalle(idVenta) {
    const { data, error } = await supabase
        .from("DETALLE_VENTA")
        .select(`
            ID_Detalle,
            ID_Producto,
            Cantidad,
            Precio,
            Sub_Total,
            PRODUCTO ( N_Producto )
        `)
        .eq("ID_Venta", idVenta)
        .order("ID_Detalle")
    if (error) return { ok: false, error }
    return { ok: true, data: data || [] }
}

export const VentaAdapter = { listar, crear, anular, obtenerDetalle }

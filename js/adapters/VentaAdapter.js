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

async function listarPedidosPendientes() {
    const { data, error } = await supabase
        .from("PEDIDO")
        .select(`
            ID_Pedido,
            Numero_Pedido,
            ID_Mesa,
            MESA ( Numero ),
            ID_Cliente,
            Situacion,
            F_Pedido,
            Total,
            CLIENTE ( ID_Cliente, PERSONA ( Nombre, Ap_Paterno ) ),
            DETALLE_PEDIDO (
                ID_DetallePedido,
                ID_Producto,
                Cantidad,
                Precio,
                Sub_Total,
                Nota,
                PRODUCTO ( N_Producto, Imagen )
            )
        `)
        .in("Situacion", ["P", "A"])
        .order("F_Pedido", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data: data || [] }
}

async function crear(datos) {
    // datos: {
    //   ID_Cliente, ID_AperturaCaja, ID_Pedido, TipoDocumento, ID_MetodoPago,
    //   T_Pagado, Monto_Recibido, USUCRE, productos: [{ ID_Producto, Cantidad, Precio }]
    // }

    /* ---------- 0. Resolver usuario de la sesión activa ---------- */
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { ok: false, error: { message: "No hay sesión de usuario activa" } }
    }
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Usuario")
        .eq("auth_id", user.id)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errUsuario || !usuario) {
        return { ok: false, error: { message: "Usuario no vinculado a la sesión activa" } }
    }
    const idUsuario = usuario.ID_Usuario

    /* ---------- 1. Validaciones previas ---------- */
    if (!datos.ID_AperturaCaja) {
        return { ok: false, error: { message: "No hay caja abierta" } }
    }
    if (datos.ID_Pedido == null) {
        return { ok: false, error: { message: "Selecciona un pedido" } }
    }
    if (datos.ID_Cliente == null) {
        return { ok: false, error: { message: "Selecciona un cliente" } }
    }

    /* ---------- 2. Llamada al procedimiento almacenado ---------- */
    // facturar_venta valida: permiso admin/cajero, apertura abierta,
    // existencia del pedido (P/A), tipo doc 01->cliente jurídico, genera
    // Numero_Venta, calcula totales, inserta VENTA/DETALLE_VENTA/PAGO_VENTA,
    // emite boleta/factura, descuenta Stock_Actual, registra movimiento de caja
    // y cierra el pedido / libera la mesa.
    const tipoDocumento = datos.TipoDocumento === "Factura" ? "01" : "03"
    const montorecibido = Number(datos.Monto_Recibido || datos.T_Pagado || 0)

    const { data, error } = await supabase.rpc("facturar_venta", {
        p_id_pedido: Number(datos.ID_Pedido),
        p_id_cliente: Number(datos.ID_Cliente),
        p_id_usuario: idUsuario,
        p_id_aperturacaja: Number(datos.ID_AperturaCaja),
        p_tipodocumento: tipoDocumento,
        p_id_metodopago: datos.ID_MetodoPago ? Number(datos.ID_MetodoPago) : null,
        p_montorecibido: montorecibido,
        p_referencia: null,
        p_descuento: 0
    })

    if (error) {
        console.error("Error en facturar_venta:", error)
        return { ok: false, error }
    }

    // facturar_venta retorna directamente el ID_Venta (número entero)
    return { ok: true, data: { ID_Venta: data } }
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

export const VentaAdapter = { listar, crear, anular, obtenerDetalle, listarPedidosPendientes }

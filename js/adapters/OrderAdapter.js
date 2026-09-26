import { supabase } from "../lib/supabaseClient.js"

const PERFIL_SELECT = `
    ID_Pedido,
    ID_Mesa,
    ID_Cliente,
    ID_Usuario,
    ID_TipoAtencion,
    Numero_Pedido,
    F_Pedido,
    N_Comensales,
    Total,
    Situacion,
    Observacion,
    FECCRE,
    DETALLE_PEDIDO (
        ID_DetallePedido,
        ID_Producto,
        Cantidad,
        Precio,
        Descuento,
        Sub_Total,
        Nota,
        PRODUCTO ( N_Producto, Imagen )
    ),
    USUARIO (
        ID_Usuario,
        Logeo
    )
`

async function resolverSesion() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { ok: false, error: error || { message: "Sin sesión" } }
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Usuario, ID_Cliente, Logeo, ESTADO, Bloqueado")
        .eq("auth_id", data.user.id)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }
    if (!usuario) return { ok: false, error: { message: "No existe un usuario vinculado a esta cuenta" } }
    return { ok: true, data: { ...usuario, email: data.user.email } }
}

async function listarMisPedidos() {
    const sesion = await resolverSesion()
    if (!sesion.ok) return sesion
    const { data, error } = await supabase
        .from("PEDIDO")
        .select(PERFIL_SELECT)
        .eq("ID_Cliente", sesion.data.ID_Cliente)
        .order("F_Pedido", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarTodos() {
    const { data, error } = await supabase
        .from("PEDIDO")
        .select(PERFIL_SELECT)
        .order("F_Pedido", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function resolverTipoAtencion() {
    const { data, error } = await supabase
        .from("TIPO_ATENCION")
        .select("ID_TipoAtencion, N_TipoAtencion")
        .eq("N_TipoAtencion", "PARA LLEVAR")
        .eq("ESTADO", "1")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

function generarNumeroPedido() {
    const base = Date.now().toString().slice(-10)
    const aleatorio = Math.random().toString(36).slice(2, 4)
    return "W" + base + "-" + aleatorio
}

function esErrorUnique(error) {
    if (!error) return false
    if (error.code === "23505") return true
    return /duplicate key|violates unique constraint|23505/i.test(error.message || "")
}

async function deshacerPedido(idPedido) {
    if (!idPedido) return
    const { error: errDelete } = await supabase
        .from("PEDIDO")
        .delete()
        .eq("ID_Pedido", idPedido)
    if (!errDelete) return
    await supabase
        .from("PEDIDO")
        .update({ Situacion: "X", USUMOD: "WEB", FECMOD: new Date().toISOString() })
        .eq("ID_Pedido", idPedido)
}

async function crearPedido(productos, total) {
    const sesion = await resolverSesion()
    if (!sesion.ok) return sesion
    if (!sesion.data.ID_Usuario) return { ok: false, error: { message: "No tiene un perfil de usuario" } }
    if (!sesion.data.ID_Cliente) return { ok: false, error: { message: "No tiene un perfil de cliente" } }

    const tipo = await resolverTipoAtencion()
    if (!tipo.ok) return { ok: false, error: tipo.error }
    if (!tipo.data) return { ok: false, error: { message: "No se encontró el tipo de atención" } }

    const usucor = (sesion.data.email || "WEB").substring(0, 30)
    let ultimoError = null

    for (let intento = 0; intento < 3; intento++) {
        const { data: pedido, error: errPedido } = await supabase
            .from("PEDIDO")
            .insert({
                ID_Cliente: sesion.data.ID_Cliente,
                ID_Usuario: sesion.data.ID_Usuario,
                ID_TipoAtencion: tipo.data.ID_TipoAtencion,
                Numero_Pedido: generarNumeroPedido(),
                N_Comensales: 1,
                Total: Number(total || 0),
                Situacion: "P",
                USUCRE: usucor
            })
            .select("ID_Pedido, Numero_Pedido")
            .maybeSingle()

        if (errPedido) {
            if (esErrorUnique(errPedido)) {
                ultimoError = errPedido
                continue
            }
            return { ok: false, error: errPedido }
        }

        const detalle = (productos || []).map(p => ({
            ID_Pedido: pedido.ID_Pedido,
            ID_Producto: Number(p.id_producto),
            Cantidad: Number(p.cantidad),
            Precio: Number(p.precio || 0),
            Descuento: 0,
            Nota: p.nota || null,
            USUCRE: usucor
        }))

        const invalido = detalle.find(d =>
            !d.ID_Producto || d.ID_Producto <= 0 ||
            !d.Cantidad || d.Cantidad <= 0
        )
        if (invalido) {
            await deshacerPedido(pedido.ID_Pedido)
            return { ok: false, error: { message: "Producto inválido en el carrito" } }
        }

        if (detalle.length) {
            const { error: errDetalle } = await supabase
                .from("DETALLE_PEDIDO")
                .insert(detalle)
            if (errDetalle) {
                await deshacerPedido(pedido.ID_Pedido)
                return { ok: false, error: errDetalle }
            }
        }

        return { ok: true, data: pedido }
    }

    return { ok: false, error: ultimoError || { message: "No se pudo registrar el pedido" } }
}

async function actualizarEstado(id, situacion) {
    const { error } = await supabase
        .from("PEDIDO")
        .update({ Situacion: situacion, USUMOD: "WEB", FECMOD: new Date().toISOString() })
        .eq("ID_Pedido", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("PEDIDO")
        .delete()
        .eq("ID_Pedido", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const OrderAdapter = { listarMisPedidos, listarTodos, crearPedido, actualizarEstado, eliminar }
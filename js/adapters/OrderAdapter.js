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

/**
 * Alta manual desde el panel: el cajero/admin elige cliente, tipo y lineas.
 * No es lo mismo que crearPedido(), que es el camino del cliente en la web
 * (mismo carrito, mismo total calculado por el servidor).
 *
 * Dos pasos sin transaccion: primero la cabecera, luego el detalle. Si el
 * detalle falla se deshace la cabecera con deshacerPedido() para no dejar un
 * pedido en cero lineas. Es compensacion, no atomicidad: entre ambas llamadas
 * un fallo de red podria dejarla a medias.
 */
async function crearManual(datos) {
    if (!datos.ID_Cliente) return { ok: false, error: { message: "Falta el cliente" } }
    if (!datos.ID_TipoAtencion) return { ok: false, error: { message: "Falta el tipo de atención" } }

    const items = Array.isArray(datos.items) ? datos.items.filter(it => it.ID_Producto) : []
    if (!items.length) return { ok: false, error: { message: "El pedido necesita al menos un producto" } }

    const { data: tipo, error: errTipo } = await supabase
        .from("TIPO_ATENCION")
        .select("ID_TipoAtencion")
        .eq("ID_TipoAtencion", datos.ID_TipoAtencion)
        .maybeSingle()
    if (errTipo || !tipo) {
        return { ok: false, error: errTipo || { message: "Tipo de atención inválido" } }
    }

    const { data: pedido, error: errPedido } = await supabase
        .from("PEDIDO")
        .insert({
            ID_Cliente: datos.ID_Cliente,
            ID_Usuario: datos.ID_Usuario || null,
            ID_TipoAtencion: datos.ID_TipoAtencion,
            Numero_Pedido: generarNumeroPedido(),
            N_Comensales: Number(datos.N_Comensales) || 1,
            Total: 0,
            Situacion: "P",
            Observacion: datos.Observacion || null,
            USUCRE: datos.USUCRE || "WEB",
        })
        .select("ID_Pedido")
        .maybeSingle()
    if (errPedido) {
        if (esErrorUnique(errPedido)) {
            return { ok: false, error: { message: "Ese número de pedido ya existe, reintenta" } }
        }
        return { ok: false, error: errPedido }
    }

    const detalle = items.map(it => ({
        ID_Pedido: pedido.ID_Pedido,
        ID_Producto: it.ID_Producto,
        Cantidad: Math.max(1, Number(it.Cantidad) || 1),
        Precio: Number(it.Precio) || 0,
        Descuento: 0,
        Sub_Total: (Math.max(1, Number(it.Cantidad) || 1)) * (Number(it.Precio) || 0),
        USUCRE: datos.USUCRE || "WEB",
    }))

    const { error: errDetalle } = await supabase
        .from("DETALLE_PEDIDO")
        .insert(detalle)
    if (errDetalle) {
        await deshacerPedido(pedido.ID_Pedido)
        return { ok: false, error: errDetalle }
    }

    const total = detalle.reduce((suma, d) => suma + d.Cantidad * d.Precio, 0)
    const { error: errTotal } = await supabase
        .from("PEDIDO")
        .update({ Total: total })
        .eq("ID_Pedido", pedido.ID_Pedido)
    if (errTotal) {
        await deshacerPedido(pedido.ID_Pedido)
        return { ok: false, error: errTotal }
    }

    return { ok: true, data: { ...pedido, Total: total } }
}

async function actualizar(id, datos) {
    const { error } = await supabase
        .from("PEDIDO")
        .update({
            Situacion: datos.Situacion,
            Observacion: datos.Observacion ?? null,
            N_Comensales: Number(datos.N_Comensales) || 1,
            USUMOD: "WEB",
            FECMOD: new Date().toISOString(),
        })
        .eq("ID_Pedido", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/** El <select> de tipo se arma con esto en vez de Suponer los ids 1/2/3. */
async function listarTipos() {
    const { data, error } = await supabase
        .from("TIPO_ATENCION")
        .select("ID_TipoAtencion, N_TipoAtencion, Requiere_Mesa")
        .eq("ESTADO", "1")
        .order("ID_TipoAtencion")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

export const OrderAdapter = {
    listarMisPedidos,
    listarTodos,
    listarTipos,
    crearPedido,
    crearManual,
    actualizar,
    actualizarEstado,
    eliminar,
}
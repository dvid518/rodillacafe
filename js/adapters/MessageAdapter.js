import { supabase } from "../lib/supabaseClient.js"

const PERFIL_SELECT = `
    ID_Mensaje,
    ID_Cliente,
    Asunto,
    Mensaje,
    Situacion,
    F_Envio,
    FECCRE,
    CLIENTE (
        ID_Cliente,
        PERSONA ( Nombre, Ap_Paterno, EMAIL )
    )
`

async function resolverCliente() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { ok: false, error: error || { message: "Sin sesión" } }
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Cliente, Logeo, ESTADO, Bloqueado")
        .eq("auth_id", data.user.id)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }
    if (!usuario || !usuario.ID_Cliente) return { ok: false, error: { message: "No existe un perfil de cliente" } }
    return { ok: true, data: { ...usuario, email: data.user.email } }
}

async function crear({ Asunto, Mensaje }) {
    const cliente = await resolverCliente()
    if (!cliente.ok) return cliente
    const asunto = (Asunto || Mensaje || "Mensaje de contacto").substring(0, 100)
    const { data, error } = await supabase
        .from("MENSAJE")
        .insert({
            ID_Cliente: cliente.data.ID_Cliente,
            Asunto: asunto,
            Mensaje: Mensaje || "",
            USUCRE: (cliente.data.email || "WEB").substring(0, 30)
        })
        .select("ID_Mensaje")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarMisMensajes() {
    const cliente = await resolverCliente()
    if (!cliente.ok) return cliente
    const { data, error } = await supabase
        .from("MENSAJE")
        .select(PERFIL_SELECT)
        .eq("ID_Cliente", cliente.data.ID_Cliente)
        .order("F_Envio", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarTodas() {
    const { data, error } = await supabase
        .from("MENSAJE")
        .select(PERFIL_SELECT)
        .order("F_Envio", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizarEstado(id, situacion) {
    const { error } = await supabase
        .from("MENSAJE")
        .update({ Situacion: situacion, USUMOD: "WEB", FECMOD: new Date().toISOString() })
        .eq("ID_Mensaje", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("MENSAJE")
        .delete()
        .eq("ID_Mensaje", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/** Alta manual desde el panel: el cliente lo elige quien esta en el mostrador. */
async function crearManual(datos) {
    if (!datos.ID_Cliente) return { ok: false, error: { message: "Falta el cliente" } }
    if (!datos.Mensaje || !datos.Mensaje.trim()) {
        return { ok: false, error: { message: "El mensaje está vacío" } }
    }

    const { data, error } = await supabase
        .from("MENSAJE")
        .insert({
            ID_Cliente: datos.ID_Cliente,
            Asunto: (datos.Asunto || "Mensaje").trim().substring(0, 100),
            Mensaje: datos.Mensaje.trim(),
            Situacion: "P",
            USUCRE: datos.USUCRE || "WEB",
        })
        .select("ID_Mensaje")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizar(id, datos) {
    const { error } = await supabase
        .from("MENSAJE")
        .update({
            Asunto: (datos.Asunto || "Mensaje").trim().substring(0, 100),
            Mensaje: datos.Mensaje,
            Situacion: datos.Situacion,
            USUMOD: "WEB",
            FECMOD: new Date().toISOString(),
        })
        .eq("ID_Mensaje", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const MessageAdapter = {
    crear,
    listarMisMensajes,
    listarTodas,
    crearManual,
    actualizar,
    actualizarEstado,
    eliminar,
}
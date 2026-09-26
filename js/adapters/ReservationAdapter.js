import { supabase } from "../lib/supabaseClient.js"

const PERFIL_SELECT = `
    ID_Reserva,
    ID_Cliente,
    ID_Mesa,
    Numero_Mesa,
    N_Comensales,
    F_Reserva,
    Situacion,
    Observacion,
    FECCRE,
    CLIENTE (
        ID_Cliente,
        PERSONA ( Nombre, Ap_Paterno, EMAIL, Celular )
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

async function crear({ N_Comensales, F_Reserva, Observacion }) {
    const cliente = await resolverCliente()
    if (!cliente.ok) return cliente
    const { data, error } = await supabase
        .from("RESERVA")
        .insert({
            ID_Cliente: cliente.data.ID_Cliente,
            N_Comensales: Number(N_Comensales),
            F_Reserva: F_Reserva,
            Observacion: Observacion || null,
            USUCRE: (cliente.data.email || "WEB").substring(0, 30)
        })
        .select("ID_Reserva")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarMisReservas() {
    const cliente = await resolverCliente()
    if (!cliente.ok) return cliente
    const { data, error } = await supabase
        .from("RESERVA")
        .select(PERFIL_SELECT)
        .eq("ID_Cliente", cliente.data.ID_Cliente)
        .order("F_Reserva", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarTodas() {
    const { data, error } = await supabase
        .from("RESERVA")
        .select(PERFIL_SELECT)
        .order("F_Reserva", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizarEstado(id, situacion) {
    const { error } = await supabase
        .from("RESERVA")
        .update({ Situacion: situacion, USUMOD: "WEB", FECMOD: new Date().toISOString() })
        .eq("ID_Reserva", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("RESERVA")
        .delete()
        .eq("ID_Reserva", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const ReservationAdapter = { crear, listarMisReservas, listarTodas, actualizarEstado, eliminar }
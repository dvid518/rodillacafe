import { supabase } from "../lib/supabaseClient.js"

/* ==========================================================================
   SALÓN — MESA, ZONA, ESTADO_MESA
   --------------------------------------------------------------------------
   Tablas definidas en sql/007.sql. El RLS ya esta preparado para este modulo
   (sql/014_rls_policies.sql y sql/018_fixes.sql):

     ZONA / ESTADO_MESA : select para todos, escritura solo is_admin()
     MESA               : select para todos, escritura is_admin(),
                          update tambien para is_operativo() (CAJERO o MOZO)

   Es decir: el mozo puede cambiar el estado de una mesa (libre, ocupada,
   reservada) pero no crearla ni borrarla. Por eso hay dos metodos distintos
   para tocarla y no se intenta un update completo con campos que el RLS
   dejaria pasar igual pero que el usuario no deberia cambiar.
   ========================================================================== */

const MESA_SELECT = `
    ID_Mesa,
    ID_Zona,
    ID_EstadoMesa,
    Numero,
    Capacidad,
    Detalle,
    ESTADO,
    ZONA ( ID_Zona, N_Zona ),
    ESTADO_MESA ( ID_EstadoMesa, Descripcion, Color )
`

/** Marca la auditoria con el momento actual. USUMOD lo pone quien llama. */
function conAuditoria(usuario) {
    return { USUMOD: usuario, FECMOD: new Date().toISOString() }
}

async function listarMesas() {
    const { data, error } = await supabase
        .from("MESA")
        .select(MESA_SELECT)
        .eq("ESTADO", "1")
        .order("ID_Zona")
        .order("Numero")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarZonas() {
    const { data, error } = await supabase
        .from("ZONA")
        .select("ID_Zona, N_Zona, Descripcion")
        .eq("ESTADO", "1")
        .order("ID_Zona")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarEstados() {
    const { data, error } = await supabase
        .from("ESTADO_MESA")
        .select("ID_EstadoMesa, Descripcion, Color")
        .eq("ESTADO", "1")
        .order("ID_EstadoMesa")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function crearMesa({ Numero, ID_Zona, ID_EstadoMesa, Capacidad, Detalle, USUCRE }) {
    const { data, error } = await supabase
        .from("MESA")
        .insert({
            Numero: String(Numero).trim(),
            ID_Zona: Number(ID_Zona),
            ID_EstadoMesa: Number(ID_EstadoMesa),
            Capacidad: Number(Capacidad) || 4,
            Detalle: Detalle?.trim() || null,
            ESTADO: "1",
            USUCRE,
        })
        .select("ID_Mesa")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizarMesa(id, { Numero, ID_Zona, ID_EstadoMesa, Capacidad, Detalle, USUMOD }) {
    const { error } = await supabase
        .from("MESA")
        .update({
            Numero: String(Numero).trim(),
            ID_Zona: Number(ID_Zona),
            ID_EstadoMesa: Number(ID_EstadoMesa),
            Capacidad: Number(Capacidad) || 4,
            Detalle: Detalle?.trim() || null,
            ...conAuditoria(USUMOD),
        })
        .eq("ID_Mesa", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/**
 * Cambio de estado a secas. Es lo unico que el RLS deja hacer a un operativo
 * (p_mesa_operativo_update), asi que va aislado: si esta funcion llegara a
 * mandar Numero o Capacidad, un mozo podria renumerar el salon.
 */
async function cambiarEstado(id, idEstadoMesa, USUMOD) {
    const { error } = await supabase
        .from("MESA")
        .update({ ID_EstadoMesa: Number(idEstadoMesa), ...conAuditoria(USUMOD) })
        .eq("ID_Mesa", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/**
 * Borrado fisico. Solo admin. Se marca ESTADO en vez de borrar cuando la mesa
 * tiene pedidos o reservas: PEDIDO y RESERVA la apuntan por FK, y sin ON
 * DELETE el borrado falla con 23503.
 */
async function eliminarMesa(id, { USUMOD, forzar = false } = {}) {
    if (forzar) {
        const { error } = await supabase.from("MESA").delete().eq("ID_Mesa", id)
        if (error) return { ok: false, error }
        return { ok: true, data: null }
    }

    const { error: errUpdate } = await supabase
        .from("MESA")
        .update({ ESTADO: "0", ...conAuditoria(USUMOD) })
        .eq("ID_Mesa", id)
    if (errUpdate) return { ok: false, error: errUpdate }
    return { ok: true, data: null }
}

async function crearZona({ N_Zona, Descripcion, USUCRE }) {
    const { data, error } = await supabase
        .from("ZONA")
        .insert({
            N_Zona: String(N_Zona).trim(),
            Descripcion: Descripcion?.trim() || null,
            ESTADO: "1",
            USUCRE,
        })
        .select("ID_Zona")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizarZona(id, { N_Zona, Descripcion, USUMOD }) {
    const { error } = await supabase
        .from("ZONA")
        .update({
            N_Zona: String(N_Zona).trim(),
            Descripcion: Descripcion?.trim() || null,
            ...conAuditoria(USUMOD),
        })
        .eq("ID_Zona", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/** Borra la zona y sus mesas en el mismo intento. */
async function eliminarZona(id) {
    const { error: errMesas } = await supabase.from("MESA").delete().eq("ID_Zona", id)
    if (errMesas) return { ok: false, error: errMesas }
    const { error } = await supabase.from("ZONA").delete().eq("ID_Zona", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const TableAdapter = {
    listarMesas,
    listarZonas,
    listarEstados,
    crearMesa,
    actualizarMesa,
    cambiarEstado,
    eliminarMesa,
    crearZona,
    actualizarZona,
    eliminarZona,
}
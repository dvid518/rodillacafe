import { supabase } from "../lib/supabaseClient.js"

const ROLES = ["ADMINISTRADOR", "CAJERO", "MOZO", "CLIENTE"]

async function getRoles() {
    const roles = []
    for (const rol of ROLES) {
        const { data, error } = await supabase.rpc("is_rol", { p_rol: rol })
        if (error) return { ok: false, error }
        if (data) roles.push(rol)
    }
    return { ok: true, data: roles }
}

async function getPerfilByAuthId(authId) {
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Usuario, ID_Cliente, Logeo, Bloqueado, ESTADO")
        .eq("auth_id", authId)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }
    if (!usuario) return { ok: false, error: { message: "No existe un usuario vinculado a esta cuenta" } }
    if (usuario.Bloqueado === "1") return { ok: false, error: { message: "El usuario está bloqueado" } }

    if (!usuario.ID_Cliente) return { ok: true, data: { ...usuario, nombre: "", email: usuario.Logeo, celular: "" } }

    const { data: cliente, error: errCliente } = await supabase
        .from("CLIENTE")
        .select("ID_Cliente, ID_Persona, Puntos, Tipo_Cliente")
        .eq("ID_Cliente", usuario.ID_Cliente)
        .maybeSingle()
    if (errCliente) return { ok: false, error: errCliente }

    let persona = null
    if (cliente && cliente.ID_Persona) {
        const { data: p, error: errPersona } = await supabase
            .from("PERSONA")
            .select("ID_Persona, Nombre, Ap_Paterno, EMAIL, Celular")
            .eq("ID_Persona", cliente.ID_Persona)
            .maybeSingle()
        if (errPersona) return { ok: false, error: errPersona }
        persona = p
    }

    return {
        ok: true,
        data: {
            ...usuario,
            ID_Persona: persona ? persona.ID_Persona : null,
            nombre: persona ? [persona.Nombre, persona.Ap_Paterno || ""].filter(Boolean).join(" ").trim() : "",
            email: persona && persona.EMAIL ? persona.EMAIL : usuario.Logeo,
            celular: persona ? persona.Celular : ""
        }
    }
}

async function listarUsuarios() {
    const { data, error } = await supabase
        .from("USUARIO")
        .select(`
            ID_Usuario,
            ID_TipoUsuario,
            Logeo,
            Bloqueado,
            ESTADO,
            CLIENTE ( ID_Cliente, PERSONA ( Nombre, Ap_Paterno, EMAIL, Celular ) ),
            USUARIO_ROL ( ID_Rol, ROL ( N_Rol ) )
        `)
        .order("ID_Usuario")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function promoverAdmin(email) {
    const { data, error } = await supabase.rpc("usp_PromoverAdmin", { p_email: email })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/**
 * Listado de clientes para los <select> de pedidos, reservas y mensajes.
 *
 * OJO con RLS: CLIENTE solo es legible por su dueno o por un admin
 * (p_cliente_select = is_owner_cliente(...) or is_admin()). Un cajero
 * recibe { ok: true, data: [] } — no un error — porque RLS filtra filas en
 * silencio. Por eso los formularios de alta manual quedan ocultos para
 * quien no sea admin: el desplegable vendria vacio.
 */
async function listarClientes() {
    const { data, error } = await supabase
        .from("CLIENTE")
        .select(`
            ID_Cliente,
            Tipo_Cliente,
            PERSONA ( Nombre, Ap_Paterno, EMAIL )
        `)
        .order("ID_Cliente")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

export const UserAdapter = { getRoles, getPerfilByAuthId, listarUsuarios, listarClientes, promoverAdmin }
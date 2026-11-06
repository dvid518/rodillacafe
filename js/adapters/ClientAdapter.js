import { supabase } from "../lib/supabaseClient.js"

const PERFIL_SELECT = `
    ID_Cliente,
    Tipo_Cliente,
    Puntos,
    F_Registro,
    Observacion,
    ESTADO,
    PERSONA ( ID_Persona, Nombre, Ap_Paterno, Ap_Materno, EMAIL, Celular, N_Documento ),
    EMPRESA ( ID_Empresa, RUC, Razon_Social, Nombre_Comercial )
`

async function listar() {
    const { data, error } = await supabase
        .from("CLIENTE")
        .select(PERFIL_SELECT)
        .eq("ESTADO", "1")
        .order("ID_Cliente", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function crear(datos) {
    const payload = {
        ID_Persona: datos.Tipo_Cliente === "N" ? Number(datos.ID_Persona) : null,
        ID_Empresa: datos.Tipo_Cliente === "J" ? Number(datos.ID_Empresa) : null,
        Tipo_Cliente: datos.Tipo_Cliente,
        Puntos: Number(datos.Puntos) || 0,
        Observacion: datos.Observacion || null,
        USUCRE: datos.USUCRE || "WEB",
        ESTADO: "1"
    }
    const { data, error } = await supabase
        .from("CLIENTE")
        .insert(payload)
        .select("ID_Cliente")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizar(id, datos) {
    const payload = {
        Puntos: datos.Puntos !== undefined ? Number(datos.Puntos) : undefined,
        Observacion: datos.Observacion !== undefined ? datos.Observacion : undefined,
        USUMOD: datos.USUMOD || "WEB",
        FECMOD: new Date().toISOString()
    }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    const { data, error } = await supabase
        .from("CLIENTE")
        .update(payload)
        .eq("ID_Cliente", id)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("CLIENTE")
        .update({ ESTADO: "0", USUMOD: "WEB", FECMOD: new Date().toISOString() })
        .eq("ID_Cliente", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

/* ---------------------------------------------------------------
   CLIENTE NATURAL RÁPIDO (desde el módulo de ventas)
   Crea PERSONA + CLIENTE vinculada en un solo paso.
   --------------------------------------------------------------- */
async function crearClienteNatural(datos) {
    const {
        nombre = "",
        apPaterno = "",
        apMaterno = null,
        nDocumento = null,
        email = null,
        celular = null,
        usucre = "WEB"
    } = datos

    // 1) Tipo de identidad DNI (o el primero disponible)
    const { data: tipoDoc } = await supabase
        .from("TIPO_IDENTIDAD")
        .select("ID_TipoIdentidad")
        .eq("ESTADO", "1")
        .order("N_TipoIdentidad")
        .limit(1)
        .maybeSingle()
    if (!tipoDoc?.ID_TipoIdentidad) {
        return { ok: false, error: { message: "No hay tipo de identidad configurado" } }
    }

    // 2) Insertar PERSONA
    const { data: persona, error: errPersona } = await supabase
        .from("PERSONA")
        .insert({
            ID_TipoIdentidad: Number(tipoDoc.ID_TipoIdentidad),
            N_Documento: String(nDocumento || "").trim() || null,
            Nombre: String(nombre || "").trim() || null,
            Ap_Paterno: String(apPaterno || "").trim() || null,
            Ap_Materno: apMaterno ? String(apMaterno).trim() || null : null,
            EMAIL: String(email || "").trim() || null,
            Celular: String(celular || "").trim() || null,
            USUCRE: String(usucre).substring(0, 30),
            ESTADO: "1",
        })
        .select()
        .maybeSingle()
    if (errPersona) return { ok: false, error: errPersona }

    // 3) Insertar CLIENTE (Tipo_Cliente = 'N' persona natural)
    const { data: cliente, error: errCliente } = await supabase
        .from("CLIENTE")
        .insert({
            ID_Persona: persona.ID_Persona,
            Tipo_Cliente: "N",
            USUCRE: String(usucre).substring(0, 30),
            ESTADO: "1",
        })
        .select()
        .maybeSingle()
    if (errCliente) return { ok: false, error: errCliente }

    return { ok: true, data: { ...cliente, persona } }
}

export const ClientAdapter = { listar, crear, actualizar, eliminar, listarPersonas, listarEmpresas, crearClienteNatural }

async function listarPersonas() {
    const { data, error } = await supabase
        .from("PERSONA")
        .select("ID_Persona, Nombre, Ap_Paterno, EMAIL, N_Documento")
        .eq("ESTADO", "1")
        .order("Nombre")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarEmpresas() {
    const { data, error } = await supabase
        .from("EMPRESA")
        .select("ID_Empresa, RUC, Razon_Social")
        .eq("ESTADO", "1")
        .order("Razon_Social")
    if (error) return { ok: false, error }
    return { ok: true, data }
}



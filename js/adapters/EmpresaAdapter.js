import { supabase } from "../lib/supabaseClient.js"

async function listar() {
    const { data, error } = await supabase
        .from("EMPRESA")
        .select("ID_Empresa, RUC, Razon_Social, Nombre_Comercial, Direccion, Telefono, EMAIL, ESTADO")
        .eq("ESTADO", "1")
        .order("ID_Empresa", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function crear(datos) {
    const payload = {
        RUC: String(datos.RUC || "").trim(),
        Razon_Social: String(datos.Razon_Social || "").trim(),
        Nombre_Comercial: datos.Nombre_Comercial || null,
        Direccion: datos.Direccion || null,
        Telefono: datos.Telefono || null,
        EMAIL: datos.EMAIL || null,
        USUCRE: datos.USUCRE || "WEB",
        ESTADO: "1"
    }
    const { data, error } = await supabase
        .from("EMPRESA")
        .insert(payload)
        .select("ID_Empresa")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizar(id, datos) {
    const payload = {
        RUC: datos.RUC,
        Razon_Social: datos.Razon_Social,
        Nombre_Comercial: datos.Nombre_Comercial,
        Direccion: datos.Direccion,
        Telefono: datos.Telefono,
        EMAIL: datos.EMAIL,
        USUMOD: "WEB",
        FECMOD: new Date().toISOString()
    }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

    const { data, error } = await supabase
        .from("EMPRESA")
        .update(payload)
        .eq("ID_Empresa", id)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("EMPRESA")
        .update({ ESTADO: "0" })
        .eq("ID_Empresa", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const EmpresaAdapter = { listar, crear, actualizar, eliminar }

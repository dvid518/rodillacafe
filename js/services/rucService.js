import { supabase } from "../lib/supabaseClient.js"

/**
 * Servicio de consulta de RUC con búsqueda previa en BD y fallback a Factiliza
 * a través de Edge Function (credenciales en el servidor, nunca en el frontend).
 *
 * 1. Primero busca en la tabla EMPRESA por RUC.
 * 2. Si no existe, invoca la Edge Function consultar-ruc, que consulta Factiliza
 *    usando claves almacenadas en variables de entorno secretas de Supabase.
 *
 * La respuesta normalizada incluye:
 *   { ruc, razonSocial, direccion, direccionCompleta, nombreComercial, estado, condicion,
 *     distrito, provincia, departamento, yaExiste }
 *
 * @returns {Promise<{ok: true, data: {ruc, razonSocial, direccion, ..., yaExiste: boolean}} | {ok: false, error: {message}}>}
 */
export async function consultarRUC(ruc) {
    const rucLimpio = String(ruc || "").replace(/\D/g, "")
    if (rucLimpio.length !== 11) {
        return { ok: false, error: { message: "El RUC debe tener 11 dígitos" } }
    }

    // 1) Buscar primero en la tabla EMPRESA (no consumir API si ya existe)
    const { data: existente, error: errBD } = await supabase
        .from("EMPRESA")
        .select("ID_Empresa, RUC, Razon_Social, Nombre_Comercial, Direccion, Telefono, EMAIL")
        .eq("RUC", rucLimpio)
        .eq("ESTADO", "1")
        .maybeSingle()

    if (errBD) {
        console.error("[rucService] Error consultando EMPRESA:", errBD)
    }

    if (existente) {
        return {
            ok: true,
            data: {
                ruc: existente.RUC,
                razonSocial: existente.Razon_Social || "",
                direccion: existente.Direccion || "",
                direccionCompleta: "",
                nombreComercial: existente.Nombre_Comercial || "",
                estado: "",
                condicion: "",
                distrito: "",
                provincia: "",
                departamento: "",
                telefono: existente.Telefono || "",
                email: existente.EMAIL || "",
                yaExiste: true
            }
        }
    }

    // 2) No existe en BD: consultar la Edge Function (claves en el servidor)
    const { data, error } = await supabase.functions.invoke("consultar-ruc", {
        body: { ruc: rucLimpio }
    })

    if (error) {
        console.error("[rucService] Edge Function error:", error)
        return {
            ok: false,
            error: { message: "No se pudo consultar el RUC: " + (error.message || error) }
        }
    }

    if (!data || !data.ok) {
        return {
            ok: false,
            error: { message: data && data.error ? data.error : "RUC no encontrado" }
        }
    }

    const json = data.data

    return {
        ok: true,
        data: {
            ruc: json.numero,
            razonSocial: json.nombre_o_razon_social || "",
            direccion: json.direccion || "",
            direccionCompleta: json.direccion_completa || "",
            nombreComercial: json.nombre_comercial || "",
            estado: json.estado || "",
            condicion: json.condicion || "",
            distrito: json.distrito || "",
            provincia: json.provincia || "",
            departamento: json.departamento || "",
            telefono: json.telefono || "",
            email: json.email || "",
            yaExiste: false
        }
    }
}

export const rucService = { consultarRUC }

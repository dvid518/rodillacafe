import { supabase } from "../lib/supabaseClient.js"

/**
 * Servicio de consulta de DNI con búsqueda previa en BD y fallback a Factiliza
 * a través de Edge Function (credenciales en el servidor, nunca en el frontend).
 *
 * 1. Primero busca en la tabla PERSONA por N_Documento.
 * 2. Si no existe, invoca la Edge Function consultar-dni, que consulta Factiliza
 *    usando claves almacenadas en variables de entorno secretas de Supabase.
 *
 * La respuesta normalizada incluye:
 *   { dni, nombres, apellidoPaterno, apellidoMaterno, yaExiste }
 *
 * @returns {Promise<{ok: true, data: {dni, nombres, apellidoPaterno, apellidoMaterno, yaExiste: boolean}} | {ok: false, error: {message}}>}
 */
export async function consultarDNI(dni) {
    const dniLimpio = String(dni).trim()
    if (!/^\d{8}$/.test(dniLimpio)) {
        return { ok: false, error: { message: "El DNI debe tener 8 dígicos" } }
    }

    // 1) Buscar primero en la tabla PERSONA (no consumir API si ya existe)
    const { data: existente, error: errBD } = await supabase
        .from("PERSONA")
        .select("ID_Persona, N_Documento, Nombre, Ap_Paterno, Ap_Materno, EMAIL, Celular")
        .eq("N_Documento", dniLimpio)
        .eq("ESTADO", "1")
        .maybeSingle()

    if (errBD) {
        console.error("[dniService] Error consultando PERSONA:", errBD)
    }

    if (existente) {
        return {
            ok: true,
            data: {
                dni: existente.N_Documento || "",
                nombres: existente.Nombre || "",
                apellidoPaterno: existente.Ap_Paterno || "",
                apellidoMaterno: existente.Ap_Materno || "",
                email: existente.EMAIL || "",
                celular: existente.Celular || "",
                yaExiste: true
            }
        }
    }

    // 2) No existe en BD: consultar la Edge Function (claves en el servidor)
    const { data, error } = await supabase.functions.invoke("consultar-dni", {
        body: { dni: dniLimpio }
    })

    if (error) {
        console.error("[dniService] Edge Function error:", error)
        return {
            ok: false,
            error: { message: "No se pudo consultar el DNI: " + (error.message || error) }
        }
    }

    if (!data || !data.ok) {
        return {
            ok: false,
            error: { message: data && data.error ? data.error : "DNI no encontrado" }
        }
    }

    const normalizado = normalizarRespuesta(data.data)

    if (normalizado && normalizado.dni) {
        return {
            ok: true,
            data: {
                ...normalizado,
                yaExiste: false
            }
        }
    }

    return {
        ok: false,
        error: { message: "Respuesta sin datos válidos del DNI" }
    }
}

/**
 * Normaliza distintas formas de respuesta de APIs de DNI a un formato común.
 * Soporta Factiliza ({ numero, nombres, apellido_paterno, apellido_materno })
 * y otros formatos planos.
 */
function normalizarRespuesta(data) {
    if (!data || typeof data !== "object") return null

    const dni = data.numero || data.dni || null
    if (!dni) return null

    const nombresCompletos =
        data.nombres ||
        data.nombre ||
        null

    return {
        dni: String(dni).replace(/\D/g, ""),
        nombres: nombresCompletos || "",
        apellidoPaterno: data.apellido_paterno || data.apellidoPaterno || data.paterno || data.apellido || "",
        apellidoMaterno: data.apellido_materno || data.apellidoMaterno || data.materno || "",
    }
}

export const dniService = { consultarDNI }

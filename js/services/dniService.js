import { API_DNI_URL, API_KEYS_DNI } from "../config.js"

/**
 * Servicio de consulta de DNI con fallback de claves de API.
 *
 * - Prueba las claves en orden hasta que una responda con éxito.
 * - El usuario nunca sabe que una clave individual falló.
 * - Solo se notifica (notifyError) cuando TODAS las claves están agotadas.
 *
 * El respuesta del API se normaliza a:
 *   { dni, nombres, apellidoPaterno, apellidoMaterno }
 *
 * @returns {Promise<{ok: true, data: {dni, nombres, apellidoPaterno, apellidoMaterno}} | {ok: false, error: {message, agotadas: number}}>}
 */
export async function consultarDNI(dni) {
    const dniLimpio = String(dni).trim()
    if (!/^\d{8}$/.test(dniLimpio)) {
        return { ok: false, error: { message: "El DNI debe tener 8 dígicos", agotadas: 0 } }
    }

    const claves = Array.isArray(API_KEYS_DNI) ? API_KEYS_DNI : []
    let ultimoError = null

    for (let i = 0; i < claves.length; i++) {
        const key = claves[i]
        const url = API_DNI_URL
            .replace("{dni}", dniLimpio)
            .replace("{key}", key !== null && key !== undefined ? String(key) : "")

        try {
            const respuesta = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(8000),
            })

            if (!respuesta.ok) {
                ultimoError = {
                    clave: i + 1,
                    status: respuesta.status,
                    message: `Clave ${i + 1}: HTTP ${respuesta.status}`,
                }
                continue
            }

            const data = await respuesta.json()
            const normalizado = normalizarRespuesta(data)

            if (normalizado && normalizado.dni) {
                return { ok: true, data: normalizado }
            }

            ultimoError = {
                clave: i + 1,
                message: `Clave ${i + 1}: respuesta sin datos válidos`,
            }
        } catch (error) {
            ultimoError = {
                clave: i + 1,
                message: `Clave ${i + 1}: ${error.message || "error de red"}`,
            }
        }
    }

    // Todas las claves agotadas: solo aquí se le avisa al usuario
    console.error("[dniService] Todas las claves de API agotadas:", ultimoError)
    return {
        ok: false,
        error: {
            message: "No se pudo consultar el DNI: todos los servicios externos están agotados",
            agotadas: claves.length,
            detalle: ultimoError,
        },
    }
}

/**
 * Normaliza distintas formas de respuesta de APIs de DNI a un formato común.
 * Soporta apis.net.pe ({nombre, paterno, materno}) y
 * dniruc.apisperu.com ({nombres, apellidoPaterno, apellidoMaterno}) entre otras.
 */
function normalizarRespuesta(data) {
    if (!data || typeof data !== "object") return null

    const dni = data.dni || data.numeroDocumento || data.documento || null
    if (!dni) return null

    const nombresCompletos =
        data.nombres ||
        data.nombre ||
        (data.apellidoPaterno
            ? [data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(" ")
            : null) ||
        null

    return {
        dni: String(dni).replace(/\D/g, ""),
        nombres: nombresCompletos || "",
        apellidoPaterno: data.apellidoPaterno || data.paterno || data.apellido || "",
        apellidoMaterno: data.apellidoMaterno || data.materno || "",
    }
}

export const dniService = { consultarDNI }

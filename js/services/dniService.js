import { API_DNI_URL, API_KEYS_DNI } from "../config.js"

/**
 * Servicio de consulta de DNI con fallback de claves de API (Factiliza).
 *
 * - Prueba las claves en orden hasta que una responda con éxito.
 * - El token se envía en el header Authorization: Bearer <token>.
 * - El usuario nunca sabe que una clave individual falló.
 * - Solo se notifica (notifyError) cuando TODAS las claves están agotadas.
 *
 * La respuesta de Factiliza se normaliza a:
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
        const url = API_DNI_URL.replace("{dni}", dniLimpio)

        try {
            const respuesta = await fetch(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${key !== null && key !== undefined ? String(key) : ""}`,
                },
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

            // Factiliza puede devolver HTTP 200 con success: false
            if (data && data.success === false) {
                ultimoError = {
                    clave: i + 1,
                    message: `Clave ${i + 1}: ${data.message || "respuesta sin éxito"}`,
                }
                continue
            }

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
    if (claves.length === 0) {
        console.error("[dniService] No hay claves de API configuradas")
        return {
            ok: false,
            error: {
                message: "No hay claves de API configuradas para consultar el DNI",
                agotadas: 0,
                detalle: null,
            },
        }
    }

    console.error("[dniService] Todas las claves de API agotadas:", ultimoError)
    return {
        ok: false,
        error: {
            message: `No se pudo consultar el DNI: todas las ${claves.length} claves de API estan agotadas`,
            agotadas: claves.length,
            detalle: ultimoError || { clave: null, message: "sin detalle" },
        },
    }
}

/**
 * Normaliza distintas formas de respuesta de APIs de DNI a un formato común.
 * Soporta Factiliza ({ status, success, data: { numero, nombres,
 * apellido_paterno, apellido_materno } }) y otros formatos planos.
 */
function normalizarRespuesta(data) {
    if (!data || typeof data !== "object") return null

    // Factiliza envuelve los datos en { status, success, message, data: { ... } }
    const payload = data.data || data

    if (payload.success === false) return null

    const dni = payload.numero || payload.dni || data.numero || data.dni || null
    if (!dni) return null

    const nombresCompletos =
        payload.nombres ||
        data.nombres ||
        data.nombre ||
        null

    return {
        dni: String(dni).replace(/\D/g, ""),
        nombres: nombresCompletos || "",
        apellidoPaterno: payload.apellido_paterno || payload.apellidoPaterno || data.apellido_paterno || data.apellidoPaterno || data.paterno || data.apellido || "",
        apellidoMaterno: payload.apellido_materno || payload.apellidoMaterno || data.apellido_materno || data.apellidoMaterno || data.materno || "",
    }
}

export const dniService = { consultarDNI }

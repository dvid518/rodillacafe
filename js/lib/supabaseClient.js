import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js"

/* ==========================================================================
   CLIENTE SUPABASE
   --------------------------------------------------------------------------
   Envuelve createClient con dos cosas que el resto del proyecto necesita:

   1. `configInvalida`: se detecta en tiempo de import, sin red. Si el host no
      tiene la forma <ref>.supabase.co, ese proyecto no existe (se borro o se
      renombro) y TODAS las peticiones mueren con ERR_NAME_NOT_RESOLVED antes
      de salir a la red. Es el fallo que se ve en la consola como
      `POST https://<ref>.supabase.co/auth/v1/token?grant_type=refresh_token`.

   2. `comprobarBackend()`: una sonda a /auth/v1/health. Existe porque
      supabase-js reintenta cada llamada de autenticacion hasta 10 veces con
      backoff cuando la red falla, y cada reintento es una linea nueva en la
      consola. Con el host caido eso se ve como diez peticiones
      `grant_type=refresh_token` seguidas y parece un problema de credenciales
      cuando en realidad no hay servidor. Comprobando antes se falla una vez,
      con un mensaje que dice la verdad.

   La sesion guardada se limpia cuando la sonda falla (limpiarSesion): una
   sesion caducada contra un backend inalcanzable deja al cliente intentando
   renovar el token en cada carga de pagina.
   ========================================================================== */

/** El host de un proyecto de Supabase es siempre <ref>.supabase.co. */
const URL_VALIDA = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)
const CLAVE_VALIDA = typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 0

export const configInvalida = !(URL_VALIDA && CLAVE_VALIDA)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
})

/* 6s: un health check contra un host que no resuelve falla en el acto, pero
   contra un host que acepta y no contesta dejaria la pagina colgada. */
const TIMEOUT_SONDA_MS = 6000

/**
 * Comprueba que el backend de Supabase responde. Un unico intento: repetir la
 * sonda seria repetir el problema que la sonda evita.
 *
 * @returns {Promise<{ok: true} | {ok: false, motivo: string, detalle: string}>}
 *   motivo: "config" (URL/clave mal escritas), "http" (responde con error),
 *           "red" (no resuelve o no hay red).
 */
export async function comprobarBackend() {
    if (configInvalida) {
        const que = URL_VALIDA ? "la publishable key" : `la URL del proyecto ("${SUPABASE_URL}")`
        return { ok: false, motivo: "config", detalle: `No se puede autenticar porque ${que} no es valida.` }
    }

    try {
        const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
            method: "GET",
            headers: { apikey: SUPABASE_ANON_KEY },
            signal: AbortSignal.timeout(TIMEOUT_SONDA_MS),
        })
        if (!respuesta.ok) {
            return { ok: false, motivo: "http", detalle: `El servidor respondio HTTP ${respuesta.status}.` }
        }
        return { ok: true }
    } catch (error) {
        return {
            ok: false,
            motivo: "red",
            detalle: error?.message || "No se pudo contactar con el servidor.",
        }
    }
}

/**
 * Borra la sesion persistida. Con el backend caido, el token guardado esta
 * caducado o es ilegible y cada recarga dispara otra ronda de refresh.
 * `signOut()` hace una peticion de red, asi que se usa el metodo interno que
 * solo toca el almacenamiento.
 */
export async function limpiarSesion() {
    try {
        await supabase.auth.signOut({ scope: "local" })
    } catch (error) {
        console.warn("[supabase] no se pudo limpiar la sesion local:", error)
    }
}
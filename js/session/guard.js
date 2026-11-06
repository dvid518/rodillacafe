import { authService } from "../services/authService.js"
import { comprobarBackend, limpiarSesion, configInvalida } from "../lib/supabaseClient.js"

/* ==========================================================================
   LIMITE DE SESION — 10 minutos, no configurable
   --------------------------------------------------------------------------
   La sesion expira un tiempo fijo despues de iniciarse. Al superar el
   limite se borra la sesion y se envia al login. No es un ajuste de usuario.
   ========================================================================== */
export const LIMITE_SESION_MIN = 10
const LIMITE_SESION_MS = LIMITE_SESION_MIN * 60 * 1000
const CLAVE_INICIO = "rodilla:sesion_inicio"

function inicioSesionGuardado() {
    const raw = localStorage.getItem(CLAVE_INICIO)
    return raw ? Number(raw) : null
}

/** true si ya pasaron los 10 minutos desde que se inicio sesion (o nunca se inicio). */
export function sesionExpirada() {
    const inicio = inicioSesionGuardado()
    return inicio === null || Date.now() - inicio > LIMITE_SESION_MS
}

/** Marca el momento en que el usuario inicio sesion. Se llama al hacer login. */
export function marcarInicioSesion() {
    localStorage.setItem(CLAVE_INICIO, String(Date.now()))
}

/** Borra la marca de inicio de sesion. Se llama al cerrar sesion. */
export function limpiarInicioSesion() {
    localStorage.removeItem(CLAVE_INICIO)
}

function esPaginaPublica() {
    const ruta = window.location.pathname
    // auth.html es la nueva pantalla de login+registro. Sin esta linea,
    // un visitante sin sesion que abriera /auth.html seria expulsado a
    // /login.html, que es justo la pagina que estamos sustituyendo.
    return /(login|register|auth)\.html$/i.test(ruta)
}

/** La pagina a la que se queria ir, sin el origen. */
function destinoActual() {
    return window.location.pathname + window.location.search + window.location.hash
}

/**
 * Sin sesion se manda a auth.html (la pantalla actual) en vez de a
 * /login.html, que es la pagina antigua que se esta sustituyendo. El destino
 * viaja en ?redirect= para que login.js devuelva al usuario donde intento
 * entrar, en lugar de dejarlo siempre en el home.
 */
function irAAuth() {
    if (esPaginaPublica()) return
    const destino = destinoActual()
    const params = new URLSearchParams()
    params.set("redirect", destino)
    window.location.href = `/auth.html?${params.toString()}`
}

/* ==========================================================================
   PANTALLA DE BACKEND CAIDO
   --------------------------------------------------------------------------
   Redirecting to /auth.html cuando no hay servidor es un bucle: ahi tampoco
   se puede autenticar, se vuelve a redirigir, y encima supabase-js sigue
   reintentando el refresh del token guardado. Se sustituye la pagina por un
   aviso que dice que pasa y deja reintentar a mano.

   guardSesion() NO se auto-invoca al importarse: el que arranca la pagina la
   llama una vez y usa lo que devuelve, para no pagar dos sondas por carga.
   ========================================================================== */
const MOTIVOS = {
    config: "El proyecto de Supabase esta mal configurado",
    http: "El servidor de autenticacion responde con un error",
    red: "No se pudo conectar con el servidor de autenticacion",
}

function mostrarFalloConexion({ motivo, detalle }) {
    const titulo = MOTIVOS[motivo] || MOTIVOS.red

    const caja = document.createElement("div")
    caja.className = "fallo-conexion"
    caja.setAttribute("role", "alert")

    const h1 = document.createElement("h1")
    h1.className = "fallo-conexion__titulo"
    h1.textContent = titulo

    const p = document.createElement("p")
    p.className = "fallo-conexion__detalle"
    p.textContent = detalle

    const ayuda = document.createElement("p")
    ayuda.className = "fallo-conexion__detalle"
    ayuda.textContent = configInvalida
        ? "Revisa SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js."
        : "El login, el panel y la carta necesitan ese servidor. Revisa SUPABASE_URL en js/config.js."

    const boton = document.createElement("button")
    boton.className = "btn btn--primary"
    boton.type = "button"
    boton.textContent = "Reintentar"
    boton.addEventListener("click", () => window.location.reload())

    caja.append(h1, p, ayuda, boton)
    document.body.replaceChildren(caja)
}

export async function guardSesion() {
    /* La sonda va PRIMERO, y solo en paginas protegidas (guard.js no se
       importa en las publicas). En la landing una caída del backend no debe
       tapar la carta: ahi cada consulta ya distingue "0" de "no disponible". */
    const backend = await comprobarBackend()
    if (!backend.ok) {
        await limpiarSesion()
        mostrarFalloConexion(backend)
        return null
    }

    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        irAAuth()
        return null
    }
    // Si hay sesión y estás en una página pública → redirige al home.
    // No se honra el redirect aquí a propósito: si el destino vuelve a
    // ser una página protegida, el visitante ya tiene sesión, así que
    // el guard lo dejaría pasar y el ciclo se repetiría.
    if (esPaginaPublica()) {
        window.location.href = "/index.html"
        return null
    }
    // Limite de sesion: 10 minutos desde el inicio. Superado el limite se
    // borra la sesion y se envia al login con aviso.
    if (sesionExpirada()) {
        await limpiarSesion()
        limpiarInicioSesion()
        const params = new URLSearchParams()
        params.set("expirada", "1")
        params.set("redirect", destinoActual())
        window.location.href = `/auth.html?${params.toString()}`
        return null
    }
    return sesion.data
}
import { authService } from "../services/authService.js"
import { comprobarBackend, limpiarSesion, configInvalida } from "../lib/supabaseClient.js"

/* ==========================================================================
   LIMITE DE INACTIVIDAD — 10 minutos, no configurable
   --------------------------------------------------------------------------
   La sesion se cierra tras 10 minutos SIN actividad del usuario. Cada
   interaccion (puntero, teclado, scroll, tactil) renueva la marca. No es un
   ajuste de usuario: el limite es fijo.
   ========================================================================== */
export const LIMITE_INACTIVIDAD_MIN = 10
const LIMITE_INACTIVIDAD_MS = LIMITE_INACTIVIDAD_MIN * 60 * 1000
const CLAVE_ULTIMA_ACTIVIDAD = "rodilla:sesion_actividad"
const CLAVE_INICIO_ANTERIOR = "rodilla:sesion_inicio"
const INTERVALO_REVISION_MS = 10 * 1000
const MIN_ENTRE_REGISTROS_MS = 1000
const EVENTOS_ACTIVIDAD = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]

function ultimaActividadGuardada() {
    const raw = localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD)
    if (!raw) return null
    const marca = Number(raw)
    return Number.isFinite(marca) ? marca : null
}

/** Guarda el instante de la ultima actividad. Se llama al entrar y en cada interaccion. */
export function registrarActividad() {
    localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now()))
}

/** Borra la marca de actividad. Se llama al cerrar sesion o al expirar. */
export function limpiarActividad() {
    localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD)
    localStorage.removeItem(CLAVE_INICIO_ANTERIOR)
    detenerVigilanciaInactividad()
}

/** true si ya pasaron los 10 minutos sin actividad (o nunca se registro actividad). */
export function sesionExpirada() {
    const ultima = ultimaActividadGuardada()
    return ultima === null || Date.now() - ultima > LIMITE_INACTIVIDAD_MS
}

let vigilanciaIniciada = false
let temporizadorRevision = null
let ultimoRegistro = 0

/** Evita escribir en localStorage en cada pixel que se mueve el raton. */
function alHaberActividad() {
    const ahora = Date.now()
    if (ahora - ultimoRegistro < MIN_ENTRE_REGISTROS_MS) return
    ultimoRegistro = ahora

    /* Si ya se supero el limite, la interaccion no debe revivir la sesion:
       se cierra en ese mismo momento. */
    if (sesionExpirada()) {
        solicitarCierrePorInactividad()
        return
    }
    registrarActividad()
}

function solicitarCierrePorInactividad() {
    cerrarSesionPorInactividad().catch(error => {
        console.error("[sesion] no se pudo cerrar por inactividad:", error)
    })
}

function esPaginaDashboard() {
    return /dashboard\.html$/i.test(window.location.pathname)
}

async function cerrarSesionPorInactividad() {
    detenerVigilanciaInactividad()
    await limpiarSesion()
    limpiarActividad()

    /* En el dashboard se manda al login conservando el destino. En una pagina
       publica (la landing) basta con recargar: la sesion queda cerrada y el
       visitante sigue pudiendo navegar sin autenticarse. */
    if (!esPaginaDashboard()) {
        window.location.reload()
        return
    }

    const params = new URLSearchParams()
    params.set("expirada", "1")
    params.set("redirect", destinoActual())
    window.location.href = `/auth.html?${params.toString()}`
}

/**
 * Empieza a vigilar la inactividad mientras la pagina este abierta. Es
 * idempotente: guardSesion() y roleGuard() pueden llamarla sin duplicar
 * listeners ni temporizadores.
 */
export function iniciarVigilanciaInactividad() {
    if (vigilanciaIniciada || esPaginaPublica()) return
    vigilanciaIniciada = true

    for (const evento of EVENTOS_ACTIVIDAD) {
        window.addEventListener(evento, alHaberActividad, { passive: true })
    }
    document.addEventListener("scroll", alHaberActividad, { capture: true, passive: true })

    temporizadorRevision = window.setInterval(() => {
        if (sesionExpirada()) solicitarCierrePorInactividad()
    }, INTERVALO_REVISION_MS)
}

export function detenerVigilanciaInactividad() {
    if (!vigilanciaIniciada) return
    vigilanciaIniciada = false

    for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alHaberActividad, { passive: true })
    }
    document.removeEventListener("scroll", alHaberActividad, { capture: true })

    if (temporizadorRevision !== null) {
        clearInterval(temporizadorRevision)
        temporizadorRevision = null
    }
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
    // Limite de inactividad: 10 minutos sin actividad. Superado el limite se
    // borra la sesion y se envia al login con aviso.
    if (sesionExpirada()) {
        await cerrarSesionPorInactividad()
        return null
    }
    // Esta carga tambien cuenta como actividad y arranca la vigilancia para
    // que la sesion se cierre sola si el usuario deja de interactuar.
    registrarActividad()
    iniciarVigilanciaInactividad()
    return sesion.data
}
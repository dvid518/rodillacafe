import { authService } from "../services/authService.js"

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

export async function guardSesion() {
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
    return sesion.data
}

guardSesion()
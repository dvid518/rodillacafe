import { authService } from "../services/authService.js"

function esPaginaPublica() {
    const ruta = window.location.pathname
    return /(login|register)\.html$/i.test(ruta)
}

export async function guardSesion() {
    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        if (!esPaginaPublica()) {
            window.location.href = "/login.html"
        }
        return null
    }
    // Si hay sesión y estás en una página pública → redirige al home
    if (esPaginaPublica()) {
        window.location.href = "/index.html"
        return null
    }
    return sesion.data
}

guardSesion()
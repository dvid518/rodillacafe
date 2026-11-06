import { authService } from "../services/authService.js"
import { userService } from "../services/userService.js"
import { limpiarSesion } from "../lib/supabaseClient.js"
import { sesionExpirada, limpiarInicioSesion } from "../session/guard.js"

export const ROLES_EMPLEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]

export async function guardRol(rolesPermitidos) {
    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        window.location.href = "/auth.html"
        return null
    }
    // Limite de sesion: 10 minutos desde el inicio (no configurable).
    if (sesionExpirada()) {
        await limpiarSesion()
        limpiarInicioSesion()
        window.location.href = "/auth.html?expirada=1"
        return null
    }
    const resultado = await userService.obtenerRoles()
    if (!resultado.ok) {
        window.location.href = "/auth.html"
        return null
    }
    const roles = resultado.data
    if (!roles.some(rol => rolesPermitidos.includes(rol))) {
        window.location.href = "/index.html"
        return null
    }
    return roles
}
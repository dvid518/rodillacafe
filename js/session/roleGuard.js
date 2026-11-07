import { authService } from "../services/authService.js"
import { userService } from "../services/userService.js"
import { limpiarSesion } from "../lib/supabaseClient.js"
import { sesionExpirada, limpiarActividad, iniciarVigilanciaInactividad } from "../session/guard.js"

export const ROLES_EMPLEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]

export async function guardRol(rolesPermitidos) {
    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        window.location.href = "/auth.html"
        return null
    }
    // Limite de inactividad: 10 minutos sin actividad (no configurable).
    if (sesionExpirada()) {
        await limpiarSesion()
        limpiarActividad()
        window.location.href = "/auth.html?expirada=1"
        return null
    }
    iniciarVigilanciaInactividad()
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
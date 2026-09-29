import { authService } from "../services/authService.js"
import { userService } from "../services/userService.js"

export const ROLES_EMPLEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]

export async function guardRol(rolesPermitidos) {
    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        window.location.href = "/auth.html"
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
import { authService } from "../services/authService.js"

let _sesion = null

export async function opcionalSesion() {
    const sesion = await authService.obtenerSesion()
    _sesion = (sesion.ok && sesion.data) ? sesion.data : null
    return _sesion
}

export function haySesion() {
    return _sesion !== null
}

export function getSesion() {
    return _sesion
}
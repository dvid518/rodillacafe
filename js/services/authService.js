import { AuthAdapter } from "../adapters/AuthAdapter.js"
import { UserAdapter } from "../adapters/UserAdapter.js"

async function login(email, password) {
    const resultado = await AuthAdapter.signIn(email, password)
    if (!resultado.ok) return { ok: false, error: { message: "Correo o contraseña incorrectos" } }
    return { ok: true, data: resultado.data }
}

async function registro(nombre, email, password) {
    const resultado = await AuthAdapter.signUp(email, password, nombre)
    if (!resultado.ok) return { ok: false, error: { message: resultado.error.message || "No se pudo crear la cuenta" } }
    return { ok: true, data: resultado.data }
}

async function logout() {
    return AuthAdapter.signOut()
}

async function obtenerSesion() {
    const resultado = await AuthAdapter.getSession()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function obtenerPerfil() {
    const sesion = await obtenerSesion()
    if (!sesion.ok) return sesion
    if (!sesion.data) return { ok: false, error: { message: "Sin sesión activa" } }
    const resultado = await UserAdapter.getPerfilByAuthId(sesion.data.user.id)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function obtenerRoles() {
    const resultado = await UserAdapter.getRoles()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const authService = { login, registro, logout, obtenerSesion, obtenerPerfil, obtenerRoles }
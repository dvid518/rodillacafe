import { AuthAdapter } from "../adapters/AuthAdapter.js"
import { UserAdapter } from "../adapters/UserAdapter.js"

async function obtenerPerfilActual() {
    const sesion = await AuthAdapter.getSession()
    if (!sesion.ok) return sesion
    if (!sesion.data) return { ok: false, error: { message: "Sin sesión activa" } }
    return UserAdapter.getPerfilByAuthId(sesion.data.user.id)
}

async function obtenerRoles() {
    const resultado = await UserAdapter.getRoles()
    if (!resultado.ok) return resultado
    return { ok: true, data: resultado.data }
}

async function listarUsuarios() {
    const resultado = await UserAdapter.listarUsuarios()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function promoverAAdmin(email) {
    const resultado = await UserAdapter.promoverAdmin(email)
    if (!resultado.ok) return { ok: false, error: { message: "No se pudo promover al usuario" } }
    return { ok: true, data: resultado.data }
}

async function listarClientes() {
    return UserAdapter.listarClientes()
}

export const userService = { obtenerPerfilActual, obtenerRoles, listarUsuarios, listarClientes, promoverAAdmin }
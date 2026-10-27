import { EmpresaAdapter } from "../adapters/EmpresaAdapter.js"

async function listarEmpresas() {
    const resultado = await EmpresaAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function crearEmpresa(datos) {
    const resultado = await EmpresaAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarEmpresa(id, datos) {
    const resultado = await EmpresaAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function eliminarEmpresa(id) {
    const resultado = await EmpresaAdapter.eliminar(id)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

export const empresaService = {
    listarEmpresas,
    crearEmpresa,
    actualizarEmpresa,
    eliminarEmpresa
}

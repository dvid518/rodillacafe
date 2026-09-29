import { CategoryAdapter } from "../adapters/CategoryAdapter.js"

async function listarCategorias() {
    const resultado = await CategoryAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function crearCategoria(datos) {
    const resultado = await CategoryAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarCategoria(id, datos) {
    const resultado = await CategoryAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function eliminarCategoria(id) {
    const resultado = await CategoryAdapter.eliminar(id)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

export const categoryService = { listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria }
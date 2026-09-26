import { CategoryAdapter } from "../adapters/CategoryAdapter.js"

async function listarCategorias() {
    const resultado = await CategoryAdapter.listar()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const categoryService = { listarCategorias }
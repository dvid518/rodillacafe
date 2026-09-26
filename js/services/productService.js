import { ProductAdapter } from "../adapters/ProductAdapter.js"

async function listarProductos() {
    return ProductAdapter.listar()
}

async function listarProductosAdmin() {
    return ProductAdapter.listarAdmin()
}

async function listarPorCategoria(idCategoria) {
    return ProductAdapter.listarPorCategoria(idCategoria)
}

async function listarUnidad() {
    return ProductAdapter.obtenerUnidadPorDefecto()
}

async function listarUnidades() {
    return ProductAdapter.listarUnidades()
}

async function crearProducto(datos) {
    const resultado = await ProductAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarProducto(id, datos) {
    const resultado = await ProductAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function eliminarProducto(id) {
    return ProductAdapter.eliminar(id)
}

export const productService = { listarProductos, listarProductosAdmin, listarPorCategoria, listarUnidad, listarUnidades, crearProducto, actualizarProducto, eliminarProducto }
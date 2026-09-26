import { supabase } from "../lib/supabaseClient.js"

/* Columnas publicas: lo unico que necesita el menu.
   Costo, Stock_Actual, Stock_Minimo, Codigo_Barras y Marca se quedan fuera a
   proposito: son datos internos del negocio. */
async function listar() {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select("ID_Producto, ID_CategoriaProducto, ID_UnidadMedida, N_Producto, Detalle, Precio, Imagen, ESTADO")
        .eq("ESTADO", "1")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/* Version de panel: incluye costo y stock, que el admin si necesita para
   calcular margen y avisar de stock bajo. Ojo: esto solo evita que la app
   los pida; no los protege. Ver la nota de PRODUCTO_PUBLICO. */
async function listarAdmin() {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select("ID_Producto, ID_CategoriaProducto, ID_UnidadMedida, N_Producto, Detalle, Precio, Costo, Stock_Actual, Stock_Minimo, Imagen, ESTADO")
        .eq("ESTADO", "1")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarPorCategoria(idCategoria) {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select("ID_Producto, ID_CategoriaProducto, ID_UnidadMedida, N_Producto, Detalle, Precio, Imagen, ESTADO")
        .eq("ID_CategoriaProducto", idCategoria)
        .eq("ESTADO", "1")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarUnidades() {
    const { data, error } = await supabase
        .from("UNIDAD_MEDIDA")
        .select("ID_UnidadMedida, N_UnidadMedida, Abreviatura")
        .eq("ESTADO", "1")
        .order("ID_UnidadMedida")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function obtenerUnidadPorDefecto() {
    const { data, error } = await supabase
        .from("UNIDAD_MEDIDA")
        .select("ID_UnidadMedida, N_UnidadMedida")
        .eq("ESTADO", "1")
        .order("ID_UnidadMedida")
        .limit(1)
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function crear(datos) {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .insert(datos)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizar(id, datos) {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .update(datos)
        .eq("ID_Producto", id)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function eliminar(id) {
    const { error } = await supabase
        .from("PRODUCTO")
        .delete()
        .eq("ID_Producto", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const ProductAdapter = { listar, listarAdmin, listarPorCategoria, listarUnidades, obtenerUnidadPorDefecto, crear, actualizar, eliminar }
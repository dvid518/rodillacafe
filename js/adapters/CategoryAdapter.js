import { supabase } from "../lib/supabaseClient.js"

async function listar() {
    const { data, error } = await supabase
        .from("CATEGORIA_PRODUCTO")
        .select("ID_CategoriaProducto, N_CategoriaProducto, Descripcion, Area_Preparacion")
        .eq("ESTADO", "1")
        .order("ID_CategoriaProducto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/** USUCRE es not null en la tabla; el controller lo manda. */
async function crear(datos) {
    const { data, error } = await supabase
        .from("CATEGORIA_PRODUCTO")
        .insert(datos)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function actualizar(id, datos) {
    const { data, error } = await supabase
        .from("CATEGORIA_PRODUCTO")
        .update(datos)
        .eq("ID_CategoriaProducto", id)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/**
 * BORRADO FISICO, no soft delete. PRODUCTO tiene FK a esta tabla
 * (FK_PRODUCTO_CATEGORIA), asi que borrar una categoria con productos
 * devuelve 23503. El controller cuenta los productos antes de preguntar,
 * pero el error se sigue manejando por si cambia el catalogo entre medias.
 */
async function eliminar(id) {
    const { error } = await supabase
        .from("CATEGORIA_PRODUCTO")
        .delete()
        .eq("ID_CategoriaProducto", id)
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

export const CategoryAdapter = { listar, crear, actualizar, eliminar }
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

export const CategoryAdapter = { listar }
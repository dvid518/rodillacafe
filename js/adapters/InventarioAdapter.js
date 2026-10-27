import { supabase } from "../lib/supabaseClient.js"

const PRODUCTO_SELECT = `
    ID_Producto,
    N_Producto,
    Stock_Actual,
    Stock_Minimo,
    Controla_Stock,
    ESTADO,
    Precio,
    CATEGORIA_PRODUCTO ( N_CategoriaProducto )
`

async function listar() {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select(PRODUCTO_SELECT)
        .eq("ESTADO", "1")
        .eq("Controla_Stock", "1")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarBajoStock() {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select(PRODUCTO_SELECT)
        .eq("ESTADO", "1")
        .eq("Controla_Stock", "1")
        .order("Stock_Actual")
    if (error) return { ok: false, error }

    // Filtrar en JS: Stock_Actual <= Stock_Minimo
    const bajoStock = (data || []).filter(p => {
        const actual = Number(p.Stock_Actual || 0)
        const minimo = Number(p.Stock_Minimo || 0)
        return actual <= minimo
    })

    return { ok: true, data: bajoStock }
}

async function ajustarStock(idProducto, nuevoStock, motivo) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: { message: "Sin sesión" } }

    const { data: usuario } = await supabase
        .from("USUARIO")
        .select("Logeo")
        .eq("auth_id", user.id)
        .maybeSingle()

    const { data, error } = await supabase
        .from("PRODUCTO")
        .update({
            Stock_Actual: Number(nuevoStock),
            USUMOD: usuario?.Logeo || "WEB",
            FECMOD: new Date().toISOString()
        })
        .eq("ID_Producto", idProducto)
        .select("ID_Producto, N_Producto, Stock_Actual")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

export const InventarioAdapter = { listar, listarBajoStock, ajustarStock }

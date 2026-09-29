import { supabase } from "../lib/supabaseClient.js"

/* Columnas publicas: lo unico que necesita el menu.
   Lee de PRODUCTO_PUBLICO (sql/021_producto_publico.sql), no de PRODUCTO.
   La tabla base quedo restringida a admin, asi que leerla sin sesion falla.
   IMPORTANTE:ProductAdapter.listar() debe apuntar a la vista. Si desplegas
   el SQL antes que este cambio, el menu se queda sin productos. */
async function listar() {
    const { data, error } = await supabase
        .from("PRODUCTO_PUBLICO")
        .select("*")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/* Version de panel: incluye costo y stock, que el admin si necesita para
   calcular margen y avisar de stock bajo. Lee de PRODUCTO, que solo es
   legible para ADMINISTRADOR (p_productos_admin_all). */
async function listarAdmin() {
    const { data, error } = await supabase
        .from("PRODUCTO")
        .select("ID_Producto, ID_CategoriaProducto, ID_UnidadMedida, N_Producto, Detalle, Precio, Costo, Stock_Actual, Stock_Minimo, Imagen, ESTADO")
        .eq("ESTADO", "1")
        .order("N_Producto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/* Sin uso hoy, pero se apunta a la vista por si alguien lo cablea: con la
   tabla base restringida, leer PRODUCTO sin sesion daria permission denied. */
async function listarPorCategoria(idCategoria) {
    const { data, error } = await supabase
        .from("PRODUCTO_PUBLICO")
        .select("*")
        .eq("ID_CategoriaProducto", idCategoria)
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
    const payload = {
        ID_CategoriaProducto: Number(datos.ID_CategoriaProducto),
        ID_UnidadMedida: Number(datos.ID_UnidadMedida),
        N_Producto: String(datos.N_Producto || "").trim(),
        Detalle: datos.Detalle || null,
        Precio: Number(datos.Precio) || 0,
        Costo: Number(datos.Costo) || 0,
        Marca: datos.Marca || null,
        Codigo_Barras: datos.Codigo_Barras || null,
        Controla_Stock: datos.Controla_Stock || "1",
        Stock_Actual: Number(datos.Stock_Actual) || 0,
        Stock_Minimo: Number(datos.Stock_Minimo) || 0,
        Es_Preparado: datos.Es_Preparado || "0",
        Afecto_IGV: datos.Afecto_IGV || "1",
        Imagen: datos.Imagen || null,
        USUCRE: String(datos.USUCRE || "WEB").substring(0, 30)
    }

    const { data, error } = await supabase
        .from("PRODUCTO")
        .insert(payload)
        .select()
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/* Solo se manda lo que llega definido: un update con todo el payload de
   `crear` pisaria Costo/Stock con 0 y romperia CK_PRODUCTO_COSTO
   (Costo <= Precio) al bajar el precio de un producto ya cargado. */
async function actualizar(id, datos) {
    const payload = {}
    if (datos.N_Producto !== undefined) payload.N_Producto = String(datos.N_Producto).trim()
    if (datos.Precio !== undefined) payload.Precio = Number(datos.Precio)
    if (datos.Imagen !== undefined) payload.Imagen = datos.Imagen || null
    if (datos.ID_CategoriaProducto !== undefined) payload.ID_CategoriaProducto = Number(datos.ID_CategoriaProducto)
    if (datos.ID_UnidadMedida !== undefined) payload.ID_UnidadMedida = Number(datos.ID_UnidadMedida)
    payload.USUMOD = String(datos.USUMOD || "WEB").substring(0, 30)
    payload.FECMOD = new Date().toISOString()

    const { data, error } = await supabase
        .from("PRODUCTO")
        .update(payload)
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
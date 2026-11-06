/**
 * Normaliza un embed de Supabase JS v2.
 *
 * Supabase puede devolver relaciones (belongs-to / uno a uno) como:
 *   - objeto:   { N_TipoMovimiento: "INGRESO" }
 *   - array:    [{ N_TipoMovimiento: "INGRESO" }]
 *   - null:     si no hay fila relacionada
 *
 * Esta función normaliza cualquier forma a un objeto o null, para que el
 * resto del código pueda usar unwrapEmbed(x)?.prop sin preocuparse de si
 * Supabase devolvió array o objeto.
 *
 * @param {any} value - El valor del embed (objeto, array o null)
 * @returns {any|null} - El primer objeto o null
 */
export function unwrapEmbed(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

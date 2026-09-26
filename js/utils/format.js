export function formatearPrecio(precio) {
    return Number(precio || 0).toFixed(2)
}

export function escaparHTML(texto = "") {
    // el & va primero: si fuera despues, escaparia los ";" de los demas.
    // las cinco entidades necesitan punto y coma.
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

export function formatearFecha(iso, opciones) {
    if (!iso) return "-"
    return new Date(iso).toLocaleString("es-PE", opciones)
}
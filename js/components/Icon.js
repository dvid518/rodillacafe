/* ==========================================================================
   ICONOS — set Lucide
   --------------------------------------------------------------------------
   Iconos incrustados como SVG en linea. Sin CDN, sin build, sin peticiones
   extra: el marcado viaja en el bundle y hereda color por currentColor.

   Origen: lucide-static v1.48.0 — https://lucide.dev — licencia ISC.
   Traidos de los archivos .svg oficiales, sin modificar su geometria.
   Lucide dibuja con trazo (no relleno), 24x24, stroke-width 2.

   Uso:
     icon("circle-check")                      -> SVGElement
     icon("circle-check", { size: 20 })        -> 20x20
     icon("circle-check", { class: "mi-clase" })
     icono("triangle-alert")                  -> string, para innerHTML

   Para anadir uno nuevo: baja el .svg de unpkg.com/lucide-static@latest/icons/
   y copia solo los hijos del <svg>, sin el tag contenedor.
   ========================================================================== */

const ICONOS = {
    "arrow-right": '<path d="M5 12h14" />\n<path d="m12 5 7 7-7 7" />',
    "bell": '<path d="M10.268 21a2 2 0 0 0 3.464 0" />\n<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />',
    "boxes": '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />\n<path d="m7 16.5-4.74-2.85" />\n<path d="m7 16.5 5-3" />\n<path d="M7 16.5v5.17" />\n<path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />\n<path d="m17 16.5-5-3" />\n<path d="m17 16.5 4.74-2.85" />\n<path d="M17 16.5v5.17" />\n<path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />\n<path d="M12 8 7.26 5.15" />\n<path d="m12 8 4.74-2.85" />\n<path d="M12 13.5V8" />',
    "calendar-days": '<path d="M8 2v3" />\n<path d="M16 2v3" />\n<rect x="3" y="3" width="18" height="18" rx="2" />\n<path d="M3 9h18" />\n<path d="M8 13h.01" />\n<path d="M12 13h.01" />\n<path d="M16 13h.01" />\n<path d="M8 17h.01" />\n<path d="M12 17h.01" />\n<path d="M16 17h.01" />',
    "chart-column": '<path d="M3 3v16a2 2 0 0 0 2 2h16" />\n<path d="M18 17V9" />\n<path d="M13 17V5" />\n<path d="M8 17v-3" />',
    "check": '<path d="M20 6 9 17l-5-5" />',
    "chevron-down": '<path d="m6 9 6 6 6-6" />',
    "chevron-left": '<path d="m15 18-6-6 6-6" />',
    "chevron-right": '<path d="m9 18 6-6-6-6" />',
    "circle-alert": '<circle cx="12" cy="12" r="10" />\n<line x1="12" x2="12" y1="8" y2="12" />\n<line x1="12" x2="12.01" y1="16" y2="16" />',
    "circle-check": '<circle cx="12" cy="12" r="10" />\n<path d="m16 9-5.5 5.5L8 12" />',
    "circle-help": '<circle cx="12" cy="12" r="10" />\n<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />\n<path d="M12 17h.01" />',
    "circle-user": '<circle cx="12" cy="12" r="10" />\n<circle cx="12" cy="10" r="3" />\n<path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />',
    "clock": '<circle cx="12" cy="12" r="10" />\n<path d="M12 6v6l4 2" />',
    "coffee": '<path d="M10 2v2" />\n<path d="M14 2v2" />\n<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />\n<path d="M6 2v2" />',
    "eye": '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />\n<circle cx="12" cy="12" r="3" />',
    "info": '<circle cx="12" cy="12" r="10" />\n<path d="M12 16v-4" />\n<path d="M12 8h.01" />',
    "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1" />\n<rect width="7" height="5" x="14" y="3" rx="1" />\n<rect width="7" height="9" x="14" y="12" rx="1" />\n<rect width="7" height="5" x="3" y="16" rx="1" />',
    "loader-circle": '<path d="M21 12a9 9 0 1 1-6.219-8.56" />',
    "log-out": '<path d="m16 17 5-5-5-5" />\n<path d="M21 12H9" />\n<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />',
    "mail": '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />\n<rect x="2" y="4" width="20" height="16" rx="2" />',
    "menu": '<path d="M4 5h16" />\n<path d="M4 12h16" />\n<path d="M4 19h16" />',
    "package": '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />\n<path d="M12 22V12" />\n<polyline points="3.29 7 12 12 20.71 7" />\n<path d="m7.5 4.27 9 5.15" />',
    "pencil": '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />\n<path d="m15 5 4 4" />',
    "plus": '<path d="M5 12h14" />\n<path d="M12 5v14" />',
    "receipt": '<path d="M12 17V7" />\n<path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" />\n<path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />',
    "search": '<path d="m21 21-4.34-4.34" />\n<circle cx="11" cy="11" r="8" />',
    "shopping-bag": '<path d="M16 10a4 4 0 0 1-8 0" />\n<path d="M3.103 6.034h17.794" />\n<path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />',
    "sliders-horizontal": '<path d="M10 5H3" />\n<path d="M12 19H3" />\n<path d="M14 3v4" />\n<path d="M16 17v4" />\n<path d="M21 12h-9" />\n<path d="M21 19h-5" />\n<path d="M21 5h-7" />\n<path d="M8 10v4" />\n<path d="M8 12H3" />',
    "trash-2": '<path d="M10 11v6" />\n<path d="M14 11v6" />\n<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />\n<path d="M3 6h18" />\n<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
    "trending-up": '<path d="M16 7h6v6" />\n<path d="m22 7-8.5 8.5-5-5L2 17" />',
    "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />\n<path d="M12 9v4" />\n<path d="M12 17h.01" />',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />\n<path d="M16 3.128a4 4 0 0 1 0 7.744" />\n<path d="M22 21v-2a4 4 0 0 0-3-3.87" />\n<circle cx="9" cy="7" r="4" />',
    "utensils": '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />\n<path d="M7 2v20" />\n<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />',
    "wallet": '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />\n<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
    "x": '<path d="M18 6 6 18" />\n<path d="m6 6 12 12" />',
}

/** Nombres disponibles, por si un name dynamico necesita validarse. */
const NOMBRES = Object.keys(ICONOS)

function plantilla(nombre, interno, { size = 24, className = "", titulo = "" } = {}) {
    const clases = ["lucide", `lucide-${nombre}`, className].filter(Boolean).join(" ")
    const atributos = titulo
        ? `role="img" aria-label="${titulo}"`
        : 'aria-hidden="true" focusable="false"'
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${clases}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${atributos}>${interno}</svg>`
}

/** Devuelve el icono como string. */
function icono(nombre, opciones = {}) {
    const interno = ICONOS[nombre]
    if (!interno) {
        console.warn(`[Icon] "${nombre}" no existe. Disponibles: ${NOMBRES.join(", ")}`)
        return ""
    }
    return plantilla(nombre, interno, opciones)
}

/** Devuelve el icono como elemento del DOM, listo para appendChild. */
function icon(nombre, opciones = {}) {
    const interno = ICONOS[nombre]
    if (!interno) {
        console.warn(`[Icon] "${nombre}" no existe. Disponibles: ${NOMBRES.join(", ")}`)
        return null
    }
    const caja = document.createElement("div")
    caja.innerHTML = plantilla(nombre, interno, opciones)
    return caja.firstElementChild
}

export { ICONOS, NOMBRES, icon, icono }

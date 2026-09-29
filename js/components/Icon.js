/* ==========================================================================
   ICONOS — Reicon (web component)
   --------------------------------------------------------------------------
   Reicon es un custom element que trae 2630 iconos con dos pesos: Outline y
   Filled. Este proyecto usa SIEMPRE Filled.

     <re-icon icon="home" weight="filled" size="24"></re-icon>

   El script se carga con `defer` en los 3 HTML, asi que al crear los
   elementos todavia puede no estar definido: se registran igual y el navegador
   los actualiza solo cuando el script llega. No hay que esperar nada.

   OJO — shadow DOM. Reicon mete el <svg> dentro de su shadow root, asi que el
   CSS del documento NO puede alcanzar el <svg> interno: hay que apuntar al
   host <re-icon>. Por eso color y tamano se siguen heredando (el host usa
   currentColor y el atributo size), pero cualquier regla `svg` de la hoja de
   estilos hay que replicarla como `re-icon`.

   OJO — outerHTML. Antes icon() devolvia un <svg> ya filled y el llamador
   podia leer element.outerHTML para meterlo en un template. Un <re-icon>
   recien creado esta VACIO (el <svg> vive en el shadow root), asi que
   outerHTML no sirve. Para templates hay que usar icono(), que devuelve el
   marcado directamente.

   Uso:
     icon("circle-check")                       -> HTMLElement <re-icon>
     icon("circle-check", { size: 20 })         -> 20x20
     icon("circle-check", { titulo: "Listo" })  -> con role="img" + aria-label
     icono("triangle-alert")                    -> string, para innerHTML

   Origen: Reicon v1.2.4 (MIT) — https://www.npmjs.com/package/reicon
   CDN: https://unpkg.com/reicon@1.2.4/cdn/reicon.js
   ========================================================================== */

/* Nombre de Reicon para cada icono que usa el proyecto. Los 40 destinos se
   verificaron uno por uno contra la lista real de Reicon: todos existen y
   todos tienen variante Filled. Si un nombre no aparece aqui, se pasa tal cual
   a Reicon, asi que tambien sirve cualquiera de sus 2630 nombres. */
const MAPA_REICON = {
    "arrow-right": "arrow-right",
    "bell": "bell",
    "boxes": "box",
    "calendar-days": "calendar-days",
    "chart-column": "chart-bar",
    "check": "check",
    "chevron-down": "chevron-down",
    "chevron-left": "chevron-left",
    "chevron-right": "chevron-right",
    "circle-alert": "alert-circle",
    "circle-check": "check-circle",
    "circle-help": "help-circle",
    "circle-user": "user-circle",
    "clock": "clock",
    "coffee": "coffee",
    "eye": "eye",
    "info": "info-circle",
    "layout-dashboard": "layout",
    "loader-circle": "loader",
    "log-out": "logout",
    "mail": "envelope",
    "map-pin": "map-point",
    "menu": "menu",
    "package": "package",
    "pencil": "edit",
    "phone": "phone",
    "plus": "plus",
    "receipt": "receipt",
    "search": "search",
    "shopping-bag": "shopping-bag",
    "sliders-horizontal": "sliders",
    "sun": "sun",
    "moon": "moon",
    "trash-2": "trash",
    "trending-up": "trend-up",
    "triangle-alert": "alert-triangle",
    "users": "users",
    "utensils": "fork-knife",
    "wallet": "wallet",
    "x": "x",
}

/** Nombres que el proyecto expone, por si uno dinamico necesita validarse. */
const NOMBRES = Object.keys(MAPA_REICON)

/**
 * Reicon solo sabe validar contra su catalogo cuando el script ya cargo, y con
 * `defer` puede no estar. Si todavia no esta, no se puede descartar nada: se
 * deja pasar el nombre y que el propio Reicon avise si no lo encuentra.
 */
function nombreValido(nombreReicon) {
    if (Object.values(MAPA_REICON).includes(nombreReicon)) return true
    const catalogo = globalThis.Reicon?.icons
    if (!Array.isArray(catalogo)) return true
    return catalogo.includes(nombreReicon)
}

function resolver(nombre) {
    const nombreReicon = MAPA_REICON[nombre] || nombre
    if (!nombreValido(nombreReicon)) {
        console.warn(`[Icon] "${nombre}" no existe en Reicon. Nombres del proyecto: ${NOMBRES.join(", ")}`)
        return null
    }
    return nombreReicon
}

/** Aplica los atributos al elemento. Reicon gestiona el aria el mismo. */
function aplicar(el, { size = 24, className = "", titulo = "", spin = false } = {}) {
    el.setAttribute("weight", "filled")
    el.setAttribute("size", size)
    if (className) el.setAttribute("class", className)
    // sin titulo el icono es decorativo: aria-hidden y fuera del accesibilidad
    if (titulo) el.setAttribute("label", titulo)
    else el.setAttribute("decorative", "")
    if (spin) el.setAttribute("spin", "")
    return el
}

function escapar(valor) {
    return String(valor).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

/** Devuelve el icono como string, para meter en innerHTML o en un template. */
function icono(nombre, opciones = {}) {
    const nombreReicon = resolver(nombre)
    if (!nombreReicon) return ""
    const partes = [`icon="${escapar(nombreReicon)}"`, 'weight="filled"', `size="${opciones.size || 24}"`]
    if (opciones.className) partes.push(`class="${escapar(opciones.className)}"`)
    if (opciones.titulo) partes.push(`label="${escapar(opciones.titulo)}"`)
    else partes.push("decorative")
    if (opciones.spin) partes.push("spin")
    return `<re-icon ${partes.join(" ")}></re-icon>`
}

/** Devuelve el icono como elemento del DOM, listo para appendChild. */
function icon(nombre, opciones = {}) {
    const nombreReicon = resolver(nombre)
    if (!nombreReicon) return null
    const el = document.createElement("re-icon")
    el.setAttribute("icon", nombreReicon)
    return aplicar(el, opciones)
}

export { MAPA_REICON, NOMBRES, icon, icono }

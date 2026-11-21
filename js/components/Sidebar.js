import { icon } from "./Icon.js"
import { notifyInfo } from "../utils/notify.js"

/* ==========================================================================
   SIDEBAR — navegacion del dashboard
   --------------------------------------------------------------------------
   El menu depende del rol y va agrupado en secciones con su propio encabezado,
   para que un ADMINISTRADOR (7 destinos) no lea lo mismo que un MOZO (4) y
   las secciones disappear no salten a la vista al cambiar de rol.

   Cada seccion es { titulo, items }. Se toma el PRIMER rol de la lista como
   principal, que es lo mismo que hace el resto del proyecto (roleGuard.js).
   ========================================================================== */

const SECCION_GENERAL = "General"

/* ==========================================================================
   INSTALACIÓN PWA — estado a nivel de módulo
   --------------------------------------------------------------------------
   dashboard.js importa este archivo estáticamente, así que este bloque se
   evalúa antes de las esperas de guardSesion() y roles. Si el listener viviera
   en el constructor del Sidebar, beforeinstallprompt ya se habría disparado y
   el botón nunca podría abrir el diálogo nativo.
   ========================================================================== */
let promptPWA = null
let pwaInstalada = false

if (typeof window !== "undefined") {
    pwaInstalada = window.matchMedia?.("(display-mode: standalone)").matches
        || window.navigator.standalone === true

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault()
        promptPWA = e
        actualizarBotonPWA()
    })

    window.addEventListener("appinstalled", () => {
        pwaInstalada = true
        promptPWA = null
        actualizarBotonPWA()
    })
}

/** Instrucciones reales según el navegador; nunca "no se puede instalar". */
function instruccionesInstalacion() {
    const ua = navigator.userAgent
    const esIOS = /iPad|iPhone|iPod/.test(ua)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

    if (esIOS) return "En Safari: pulsa Compartir → «Añadir a pantalla de inicio»."
    if (/Edg\//.test(ua)) return "En Edge: menú ⋯ → Aplicaciones → «Instalar este sitio como aplicación»."
    if (/OPR\//.test(ua)) return "En Opera: menú → «Instalar aplicación»."
    if (/Firefox\//.test(ua)) return "En Firefox: menú ⋮ → «Instalar sitio web como aplicación»."
    if (/Chrome\//.test(ua)) return "En Chrome: menú ⋮ → «Instalar aplicación»."
    return "En el menú del navegador elige «Instalar aplicación» o «Añadir a pantalla de inicio»."
}

/** Ajusta el botón ya insertado en el DOM (o no hace nada si aún no existe). */
function actualizarBotonPWA() {
    const btn = document.getElementById("sidebar-instalar-pwa")
    if (!btn) return

    const bloque = btn.closest(".sidebar__grupo--app")
    if (pwaInstalada) {
        if (bloque) bloque.hidden = true
        return
    }

    if (bloque) bloque.hidden = false
    btn.hidden = false

    const texto = btn.querySelector("span")
    if (texto) texto.textContent = promptPWA ? "Instalar Rodilla" : "Cómo instalar Rodilla"
    btn.title = promptPWA
        ? "Instalar la aplicación en este dispositivo"
        : instruccionesInstalacion()
}

async function instalarPWA() {
    if (pwaInstalada) return

    if (!promptPWA) {
        notifyInfo(instruccionesInstalacion())
        return
    }

    // Un evento beforeinstallprompt solo se puede usar una vez.
    const evento = promptPWA
    promptPWA = null

    try {
        await evento.prompt()
        const resultado = await evento.userChoice
        if (resultado.outcome === "accepted") pwaInstalada = true
    } catch (error) {
        console.warn("[PWA] Error al instalar:", error)
    }
    actualizarBotonPWA()
}

const MENU_ADMIN = [
    { titulo: SECCION_GENERAL, items: [
        { seccion: "/dashboard",            titulo: "Panel",      icono: "layout-dashboard" },
    ]},
    { titulo: "Catálogo", items: [
        { seccion: "/dashboard/carta",      titulo: "Carta",      icono: "coffee" },
        { seccion: "/dashboard/categorias", titulo: "Categorías", icono: "boxes" },
    ]},
    { titulo: "Operación", items: [
        { seccion: "/dashboard/pedidos",    titulo: "Pedidos",  icono: "receipt" },
        { seccion: "/dashboard/ventas",     titulo: "Ventas",   icono: "dollar-sign" },
        { seccion: "/dashboard/caja",       titulo: "Caja",     icono: "wallet" },
        { seccion: "/dashboard/inventario", titulo: "Inventario", icono: "package" },
        { seccion: "/dashboard/reportes",   titulo: "Reportes", icono: "chart-column" },
        { seccion: "/dashboard/mesas",      titulo: "Salón",    icono: "utensils" },
        { seccion: "/dashboard/reservas",   titulo: "Reservas", icono: "calendar-days" },
    ]},
    { titulo: "Administración", items: [
        { seccion: "/dashboard/clientes",   titulo: "Clientes",   icono: "users" },
        { seccion: "/dashboard/empresas",   titulo: "Empresas",   icono: "building" },
        { seccion: "/dashboard/mensajes",   titulo: "Mensajes",   icono: "mail" },
        { seccion: "/dashboard/usuarios",   titulo: "Usuarios",   icono: "users" },
    ]},
]

const MENU_OPERATIVO = [
    { titulo: SECCION_GENERAL, items: [
        { seccion: "/dashboard",            titulo: "Panel",    icono: "layout-dashboard" },
    ]},
    { titulo: "Operación", items: [
        { seccion: "/dashboard/pedidos",    titulo: "Pedidos",  icono: "receipt" },
        { seccion: "/dashboard/ventas",     titulo: "Ventas",   icono: "dollar-sign" },
        { seccion: "/dashboard/caja",       titulo: "Caja",     icono: "wallet" },
        { seccion: "/dashboard/mesas",      titulo: "Salón",    icono: "utensils" },
        { seccion: "/dashboard/reservas",   titulo: "Reservas", icono: "calendar-days" },
    ]},
    { titulo: "Comunicación", items: [
        { seccion: "/dashboard/mensajes",   titulo: "Mensajes", icono: "mail" },
    ]},
]

const MENU_CLIENTE = [
    { titulo: SECCION_GENERAL, items: [
        { seccion: "/dashboard",             titulo: "Panel",        icono: "layout-dashboard" },
    ]},
    { titulo: "Mis gestión", items: [
        { seccion: "/dashboard/mis-pedidos", titulo: "Mis pedidos",  icono: "receipt" },
        { seccion: "/dashboard/mis-reservas",titulo: "Mis reservas", icono: "calendar-days" },
        { seccion: "/dashboard/mis-mensajes",titulo: "Mis mensajes", icono: "mail" },
    ]},
]

export class Sidebar {
    constructor({ seccion = null, rol = "CLIENTE", onLogout = null } = {}) {
        this.seccion = seccion
        this.rol = rol
        this.onLogout = onLogout
    }

    _menu() {
        if (this.rol === "ADMINISTRADOR") return MENU_ADMIN
        if (this.rol === "CAJERO") return MENU_OPERATIVO
        if (this.rol === "MOZO") {
            // MOZO no ve la caja: filtrar el ítem "/dashboard/caja"
            return MENU_OPERATIVO.map(grupo => ({
                ...grupo,
                items: grupo.items.filter(item => item.seccion !== "/dashboard/caja")
            }))
        }
        return MENU_CLIENTE
    }

    _crearEnlace(item) {
        const a = document.createElement("a")
        a.className = "sidebar__link"
        a.href = `#${item.seccion}`

        const activo = item.seccion === this.seccion
        if (activo) {
            a.classList.add("sidebar__link--active")
            // el enlace activo se anuncia, no solo se pinta
            a.setAttribute("aria-current", "page")
        }

        const ic = icon(item.icono, { size: 18 })
        if (ic) a.appendChild(ic)

        const txt = document.createElement("span")
        txt.textContent = item.titulo
        a.appendChild(txt)

        return a
    }

    render() {
        const aside = document.createElement("aside")
        aside.className = "sidebar"
        aside.setAttribute("aria-label", "Navegación del panel")

        const marca = document.createElement("div")
        marca.className = "sidebar__brand"
        const enlaceMarca = document.createElement("a")
        enlaceMarca.href = "/"
        enlaceMarca.className = "sidebar__logo"
        enlaceMarca.textContent = "Rodilla"
        const sub = document.createElement("span")
        sub.className = "sidebar__sub"
        sub.textContent = "Panel"
        marca.append(enlaceMarca, sub)

        const nav = document.createElement("nav")
        nav.className = "sidebar__nav"

        for (const grupo of this._menu()) {
            // la lista de cada grupo es su propia <ul>, para que el encabezado
            // sea de verdad un encabezado del menu y no texto suelto
            const lista = document.createElement("ul")
            lista.className = "sidebar__grupo"

            if (grupo.titulo !== SECCION_GENERAL) {
                const etiqueta = document.createElement("p")
                etiqueta.className = "sidebar__seccion"
                etiqueta.textContent = grupo.titulo
                lista.appendChild(etiqueta)
            }

            for (const item of grupo.items) {
                const li = document.createElement("li")
                li.appendChild(this._crearEnlace(item))
                lista.appendChild(li)
            }

            nav.appendChild(lista)
        }

        aside.append(marca, nav)

        /* Bloque de instalación PWA al fondo del sidebar. */
        const instalacion = document.createElement("ul")
        instalacion.className = "sidebar__grupo sidebar__grupo--app"

        const etiquetaApp = document.createElement("p")
        etiquetaApp.className = "sidebar__seccion"
        etiquetaApp.textContent = "Aplicación"

        const liApp = document.createElement("li")
        liApp.appendChild(this._crearBotonInstalacion())
        instalacion.append(etiquetaApp, liApp)

        aside.append(instalacion)
        // Ya en el DOM: aplicar el estado real (prompt disponible o instalada).
        actualizarBotonPWA()
        return aside
    }

    /* ========================================================================
       INSTALACIÓN PWA (la lógica vive arriba, a nivel de módulo)
       ======================================================================== */

    _crearBotonInstalacion() {
        const btn = document.createElement("button")
        btn.id = "sidebar-instalar-pwa"
        btn.type = "button"
        btn.className = "sidebar__link"

        const ic = icon("arrow-right", { size: 18 })
        if (ic) btn.appendChild(ic)

        const txt = document.createElement("span")
        txt.textContent = "Cómo instalar Rodilla"
        btn.appendChild(txt)

        btn.addEventListener("click", instalarPWA)

        // Estado inicial oculto hasta saber si aplica (se ajusta al insertarlo).
        btn.hidden = true

        return btn
    }
    setSeccion(seccion) {
        this.seccion = seccion
        const aside = document.querySelector(".sidebar")
        if (!aside) return
        aside.querySelectorAll(".sidebar__link").forEach(a => {
            const esActiva = a.getAttribute("href") === `#${seccion}`
            a.classList.toggle("sidebar__link--active", esActiva)
            if (esActiva) a.setAttribute("aria-current", "page")
            else a.removeAttribute("aria-current")
        })
    }
}

/* PWA — Requisitos de iconos (pendientes de incorporación por el Product Owner).
   Colocar en img/pwa/ los archivos PNG con transparencia:
     - icon-192.png   (192 × 192 px, purpose: any)
     - icon-512.png   (512 × 512 px, purpose: any)
     - icon-maskable-512.png (512 × 512 px, purpose: maskable, zona segura)
   Sin estos archivos, manifest.webmanifest referencias devuelven 404 y
   Chrome/Edge no ofrecerán la instalación de la PWA.
   No generar imágenes ni sustituir por recursos improvisados.
*/

export default Sidebar
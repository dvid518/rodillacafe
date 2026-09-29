import { icon } from "./Icon.js"

/* ==========================================================================
   SIDEBAR — navegacion del dashboard
   --------------------------------------------------------------------------
   El menu depende del rol. Se toma el PRIMER rol de la lista como principal,
   que es lo mismo que hace el resto del proyecto (roleGuard.js).
   ========================================================================== */

const MENU_ADMIN = [
    { seccion: "/dashboard",           titulo: "Panel",       icono: "layout-dashboard" },
    { seccion: "/dashboard/carta",     titulo: "Carta",       icono: "coffee" },
    { seccion: "/dashboard/categorias",titulo: "Categorías",  icono: "boxes" },
    { seccion: "/dashboard/pedidos",   titulo: "Pedidos",     icono: "receipt" },
    { seccion: "/dashboard/reservas",  titulo: "Reservas",    icono: "calendar-days" },
    { seccion: "/dashboard/mensajes",  titulo: "Mensajes",    icono: "mail" },
    { seccion: "/dashboard/usuarios",  titulo: "Usuarios",    icono: "users" },
]

const MENU_OPERATIVO = [
    { seccion: "/dashboard",           titulo: "Panel",       icono: "layout-dashboard" },
    { seccion: "/dashboard/pedidos",   titulo: "Pedidos",     icono: "receipt" },
    { seccion: "/dashboard/reservas",  titulo: "Reservas",    icono: "calendar-days" },
    { seccion: "/dashboard/mensajes",  titulo: "Mensajes",    icono: "mail" },
]

const MENU_CLIENTE = [
    { seccion: "/dashboard",                titulo: "Panel",        icono: "layout-dashboard" },
    { seccion: "/dashboard/mis-pedidos",    titulo: "Mis pedidos",  icono: "receipt" },
    { seccion: "/dashboard/mis-reservas",   titulo: "Mis reservas", icono: "calendar-days" },
    { seccion: "/dashboard/mis-mensajes",   titulo: "Mis mensajes", icono: "mail" },
]

export class Sidebar {
    constructor({ seccion = null, rol = "CLIENTE", onLogout = null } = {}) {
        this.seccion = seccion
        this.rol = rol
        this.onLogout = onLogout
    }

    _menu() {
        if (this.rol === "ADMINISTRADOR") return MENU_ADMIN
        if (this.rol === "CAJERO" || this.rol === "MOZO") return MENU_OPERATIVO
        return MENU_CLIENTE
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

        for (const item of this._menu()) {
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

            nav.appendChild(a)
        }

        const salida = document.createElement("button")
        salida.className = "sidebar__logout"
        salida.type = "button"
        const icSalir = icon("log-out", { size: 18 })
        if (icSalir) salida.appendChild(icSalir)
        const txtSalir = document.createElement("span")
        txtSalir.textContent = "Cerrar sesión"
        salida.appendChild(txtSalir)
        if (this.onLogout) salida.addEventListener("click", this.onLogout)

        const pie = document.createElement("p")
        pie.className = "sidebar__rol"
        pie.textContent = this.rol

        aside.append(marca, nav, salida, pie)
        return aside
    }

    /** Marca la seccion activa sin volver a renderizar todo el menu. */
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

export default Sidebar

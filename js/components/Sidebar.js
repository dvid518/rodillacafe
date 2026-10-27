import { icon } from "./Icon.js"

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
        { seccion: "/dashboard/simulacion", titulo: "Simulación", icono: "play-circle" },
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
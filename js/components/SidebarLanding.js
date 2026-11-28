import { icon } from "./Icon.js"

const LINKS_LANDING = [
    { seccion: "/",             titulo: "Inicio",       icono: "home" },
    { seccion: "/menu",         titulo: "Menú",         icono: "coffee" },
    { seccion: "/reservas",     titulo: "Reservas",     icono: "calendar-days" },
    { seccion: "/nosotros",     titulo: "Nosotros",     icono: "users" },
    { seccion: "/contacto",     titulo: "Contacto",     icono: "mail" },
]

export class SidebarLanding {
    constructor({ seccion = "/" } = {}) {
        this.seccion = seccion
    }

    _crearEnlace(item) {
        const a = document.createElement("a")
        a.className = "sidebar__link"
        a.href = `#${item.seccion}`

        const activo = item.seccion === this.seccion
        if (activo) {
            a.classList.add("sidebar__link--active")
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
        aside.setAttribute("aria-label", "Navegación principal")

        const marca = document.createElement("div")
        marca.className = "sidebar__brand"
        const enlaceMarca = document.createElement("a")
        enlaceMarca.href = "#/"
        enlaceMarca.className = "sidebar__logo"
        enlaceMarca.textContent = "Rodilla"
        const sub = document.createElement("span")
        sub.className = "sidebar__sub"
        sub.textContent = "Cafetería de especialidad"
        marca.append(enlaceMarca, sub)

        const nav = document.createElement("nav")
        nav.className = "sidebar__nav"

        const lista = document.createElement("ul")
        lista.className = "sidebar__grupo"

        for (const item of LINKS_LANDING) {
            const li = document.createElement("li")
            li.appendChild(this._crearEnlace(item))
            lista.appendChild(li)
        }

        nav.appendChild(lista)
        aside.append(marca, nav)

        return aside
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

export default SidebarLanding
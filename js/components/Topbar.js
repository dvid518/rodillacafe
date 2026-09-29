import { icon } from "./Icon.js"

/* ==========================================================================
   TOPBAR — cabecera del dashboard
   --------------------------------------------------------------------------
   En el enunciado el boton de tema creaba el icono en una variable
   (icSol) y nunca lo anidia al boton: salia un boton vacio de 40x40 sin
   ningun glifo. Aqui se anida, y se elige sol o luna segun el tema actual.

   El boton de burger se genera siempre, pero el CSS lo oculta en escritorio
   (el sidebar ya esta visible ahi) y solo lo muestra en movil.
   ========================================================================== */

export class Topbar {
    constructor({
        user = null,
        titulo = "",
        onLogout = null,
        onToggleSidebar = null,
        onToggleTheme = null,
    } = {}) {
        this.user = user
        this.titulo = titulo
        this.onLogout = onLogout
        this.onToggleSidebar = onToggleSidebar
        this.onToggleTheme = onToggleTheme
    }

    /** Nombre legible del usuario, con degradaciones. */
    _nombre() {
        const u = this.user || {}
        if (u.nombre) return u.nombre
        if (u.Nombre) return u.Nombre
        if (u.email) return u.email
        if (u.EMAIL) return u.EMAIL
        return "Invitado"
    }

    render() {
        const header = document.createElement("header")
        header.className = "topbar glass"

        // --- burger (solo movil) ---
        const burger = document.createElement("button")
        burger.className = "topbar__burger"
        burger.type = "button"
        burger.setAttribute("aria-label", "Abrir menú de navegación")
        burger.setAttribute("aria-controls", "app")
        const icMenu = icon("menu", { size: 24 })
        if (icMenu) burger.appendChild(icMenu)
        if (this.onToggleSidebar) {
            burger.addEventListener("click", () => {
                this.onToggleSidebar()
                // aria-expanded refleja el estado real del sidebar
                const abierto = document.querySelector(".sidebar--abierto")
                burger.setAttribute("aria-expanded", abierto ? "true" : "false")
            })
        }

        // --- titulo ---
        const titulo = document.createElement("h1")
        titulo.className = "topbar__titulo"
        titulo.textContent = this.titulo

        // --- acciones ---
        const derecha = document.createElement("div")
        derecha.className = "topbar__right"

        const usuario = document.createElement("span")
        usuario.className = "topbar__usuario"
        usuario.textContent = this._nombre()

        const botonTema = document.createElement("button")
        botonTema.className = "topbar__accion"
        botonTema.type = "button"
        const oscuro = document.documentElement.dataset.theme === "dark"
        botonTema.setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro")
        // el icono SI se anida: sol cuando estamos en oscuro, luna al reves
        const icTema = icon(oscuro ? "sun" : "moon", { size: 20 })
        if (icTema) botonTema.appendChild(icTema)
        if (this.onToggleTheme) botonTema.addEventListener("click", this.onToggleTheme)

        derecha.append(usuario, botonTema)

        if (this.onLogout) {
            const salir = document.createElement("button")
            salir.className = "topbar__accion"
            salir.type = "button"
            salir.setAttribute("aria-label", "Cerrar sesión")
            const icSalir = icon("log-out", { size: 20 })
            if (icSalir) salir.appendChild(icSalir)
            salir.addEventListener("click", this.onLogout)
            derecha.appendChild(salir)
        }

        header.append(burger, titulo, derecha)
        return header
    }

    /** Cambia solo el texto del titulo, sin rehacer la cabecera. */
    setTitulo(titulo) {
        this.titulo = titulo
        const nodo = document.querySelector(".topbar__titulo")
        if (nodo) nodo.textContent = titulo
    }
}

export default Topbar

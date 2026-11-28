import { icon } from "./Icon.js"

/* ==========================================================================
   TOPBAR LANDING — cabecera de la landing page
   --------------------------------------------------------------------------
   Igual que Topbar del dashboard pero simplificado: botón burger (móvil),
   título de la sección, botón de tema, botón de carrito. Sin usuario ni logout.
   ========================================================================== */

export class TopbarLanding {
    constructor({
        titulo = "",
        onToggleSidebar = null,
        onToggleTheme = null,
        onOpenCarrito = null,
    } = {}) {
        this.titulo = titulo
        this.onToggleSidebar = onToggleSidebar
        this.onToggleTheme = onToggleTheme
        this.onOpenCarrito = onOpenCarrito
    }

    _crearBotonCarrito() {
        const boton = document.createElement("button")
        boton.className = "boton-carrito"
        boton.type = "button"
        boton.id = "abrir-carrito"
        boton.setAttribute("aria-label", "Abrir carrito")
        const ic = icon("shopping-bag", { size: 18 })
        if (ic) boton.appendChild(ic)
        const cantidad = document.createElement("span")
        cantidad.className = "cantidad-carrito"
        cantidad.id = "cantidad-carrito"
        cantidad.textContent = "0"
        boton.appendChild(cantidad)
        if (this.onOpenCarrito) {
            boton.addEventListener("click", this.onOpenCarrito)
        }
        return boton
    }

    render() {
        const header = document.createElement("header")
        header.className = "topbar glass"

        // --- burger (solo móvil) ---
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
                const abierto = document.querySelector(".sidebar--abierto")
                burger.setAttribute("aria-expanded", abierto ? "true" : "false")
            })
        }

        // --- título ---
        const titulo = document.createElement("h1")
        titulo.className = "topbar__titulo"
        titulo.textContent = this.titulo

        // --- acciones (carrito + tema) ---
        const derecha = document.createElement("div")
        derecha.className = "topbar__right"

        if (this.onOpenCarrito) {
            derecha.appendChild(this._crearBotonCarrito())
        }

        const botonTema = document.createElement("button")
        botonTema.className = "topbar__accion"
        botonTema.type = "button"
        const oscuro = document.documentElement.dataset.theme === "dark"
        botonTema.setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro")
        const icTema = icon(oscuro ? "sun" : "moon", { size: 20 })
        if (icTema) botonTema.appendChild(icTema)
        if (this.onToggleTheme) botonTema.addEventListener("click", this.onToggleTheme)

        derecha.append(botonTema)

        header.append(burger, titulo, derecha)
        return header
    }

    setTitulo(titulo) {
        this.titulo = titulo
        const nodo = document.querySelector(".topbar__titulo")
        if (nodo) nodo.textContent = titulo
    }
}

export default TopbarLanding
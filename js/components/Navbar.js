import { icon } from "./Icon.js"

/* ==========================================================================
   NAVBAR
   --------------------------------------------------------------------------
   Funciona en dos modos, porque conviven dos tipos de pagina:

   modo "hash"    → la landing nueva (index.html). No hay router todavia, asi
                    que por defecto se usan enlaces de pagina reales, que
                    funcionan en cualquier pagina. Un dia, cuando exista el
                    router, se pondran los hash y el cambio sera de una linea.
                    No puse "#/menu" porque en los HTML viejos un hash no
                    navega a ninguna parte: se veria un navbar clicable que
                    no lleva a nada.

   modo "paginas" → los ~15 HTML antiguos, que se montan desde layout.js.
                    Aqui se conservan intactos el menu fullscreen, el boton
                    de carrito y el de salir, porque menu.js, carrito.js y el
                    propio layout.js dependen de esos nodos por id y clase.

   El modo se decide solo: si te pasan `root` (que es lo que hace layout.js),
   es modo paginas. No hay que tocar layout.js.
   ========================================================================== */

const LINKS = [
    { id: "index-i", nombre: "Inicio", hash: "#/", pagina: "index.html" },
    { id: "menu-i", nombre: "Menú", hash: "#/menu", pagina: "menu.html" },
    { id: "reserva-i", nombre: "Reservas", hash: "#/reservas", pagina: "reserva.html" },
    { id: "nosotros-i", nombre: "Nosotros", hash: "#/nosotros", pagina: "nosotros.html" },
    { id: "contacto-i", nombre: "Contacto", hash: "#/contacto", pagina: "contacto.html" },
]

const LINKS_ADMIN = [
    { nombre: "Carta", pagina: "panel-carta.html" },
    { nombre: "Reservas", pagina: "panel-reservas.html" },
    { nombre: "Mensajes", pagina: "panel-mensajes.html" },
    { nombre: "Pedidos", pagina: "panel-pedidos.html" },
    { nombre: "Usuarios", pagina: "panel-usuarios.html" },
]

export class Navbar {
    constructor({
        session = null,
        root = null,
        onSalir = null,
        onToggleTema = null,
        mostrarCarrito = false,
        modoHash = false,
    } = {}) {
        this.session = session
        this.root = root
        this.onSalir = typeof onSalir === "function" ? onSalir : null
        this.onToggleTema = typeof onToggleTema === "function" ? onToggleTema : null
        this.mostrarCarrito = mostrarCarrito
        // layout.js siempre pasa root; la landing nueva no. De ahi sale el modo.
        this.modoHash = modoHash || !root
        this.esAdmin = root === "../"
        this.element = null
    }

    _href(item) {
        return this.modoHash ? item.hash : (this.root || "/") + item.pagina
    }

    _crearEnlace(item, { clase = "item", extra = "" } = {}) {
        const a = document.createElement("a")
        a.className = clase
        if (item.id) a.id = item.id
        if (extra) a.classList.add(extra)
        a.href = this._href(item)
        a.textContent = item.nombre
        return a
    }

    /* --- menu fullscreen: solo en modo paginas (lo consume menu.js) --- */
    _crearMenuFullscreen() {
        const seccion = document.createElement("section")
        seccion.className = "menu-fullscreen glass"
        seccion.id = "menu"

        const cerrar = document.createElement("button")
        cerrar.className = "exis item"
        cerrar.type = "button"
        cerrar.setAttribute("aria-label", "Cerrar menú")
        const icCerrar = icon("x", { size: 28 })
        if (icCerrar) cerrar.appendChild(icCerrar)

        const logo = document.createElement("a")
        logo.className = "nav-logo item"
        logo.href = this._href(LINKS[0])
        logo.textContent = "Rodilla"

        const lista = document.createElement("div")
        lista.className = "menu-list"

        for (const item of LINKS) {
            const a = this._crearEnlace(item)
            a.classList.add("a")
            lista.appendChild(a)
        }

        const reserva = document.createElement("div")
        reserva.className = "btn"
        const aReserva = document.createElement("a")
        aReserva.href = this._href(LINKS[2])
        aReserva.textContent = "Reservar ahora"
        reserva.appendChild(aReserva)
        lista.appendChild(reserva)

        if (this.session && this.onSalir) lista.appendChild(this._crearBotonSalir())

        seccion.append(cerrar, logo, lista)
        return seccion
    }

    _crearBotonSalir() {
        const boton = document.createElement("button")
        boton.className = "logout-btn"
        boton.type = "button"
        const ic = icon("log-out", { size: 16 })
        if (ic) boton.appendChild(ic)
        const txt = document.createElement("span")
        txt.textContent = "Salir"
        boton.appendChild(txt)
        boton.addEventListener("click", this.onSalir)
        return boton
    }

    /**
     * Boton de tema. Mismo criterio que el del Topbar (Topbar.js:73): el
     * icono es el del tema al que se va, no el actual —sol cuando estamos en
     * oscuro, luna al reves— y por eso hay que rehacer el navbar al cambiar
     * el atributo, no basta con tocar el boton.
     */
    _crearBotonTema() {
        const boton = document.createElement("button")
        boton.type = "button"
        boton.className = "nav-tema"
        const oscuro = document.documentElement.dataset.theme === "dark"
        boton.setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro")
        boton.title = oscuro ? "Tema claro" : "Tema oscuro"
        const icTema = icon(oscuro ? "sun" : "moon", { size: 18 })
        if (icTema) boton.appendChild(icTema)
        if (this.onToggleTema) boton.addEventListener("click", this.onToggleTema)
        return boton
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
        return boton
    }

    render() {
        const bloque = document.createElement("div")
        bloque.className = "block-menu"

        const header = document.createElement("header")
        header.className = "navbar glass"

        // --- logo ---
        const logo = document.createElement("a")
        logo.className = "nav-logo item"
        logo.href = this._href(LINKS[0])
        logo.textContent = "Rodilla"

        // --- links ---
        const nav = document.createElement("nav")
        nav.className = "nav-menu"
        for (const item of LINKS) nav.appendChild(this._crearEnlace(item))

        if (this.esAdmin) {
            for (const item of LINKS_ADMIN) {
                const a = document.createElement("a")
                a.className = "item"
                a.href = this.root + item.pagina
                a.textContent = item.nombre
                nav.appendChild(a)
            }
        }

        // --- derecha ---
        const derecha = document.createElement("div")
        derecha.className = "right"

        // Tema antes del enlace de sesion: son los dos controles de la derecha
        if (this.onToggleTema) derecha.appendChild(this._crearBotonTema())

        // "Mi panel" / "Iniciar sesión": lo nuevo, coexiste con el logout viejo
        const panel = document.createElement("a")
        panel.className = "btn"
        const aPanel = document.createElement("a")
        aPanel.href = "/dashboard.html"
        aPanel.textContent = this.session ? "Mi panel" : "Iniciar sesión"
        panel.appendChild(aPanel)
        derecha.appendChild(panel)

        if (this.mostrarCarrito) derecha.appendChild(this._crearBotonCarrito())

        if (this.session && this.onSalir && this.modoHash) {
            derecha.appendChild(this._crearBotonSalir())
        }

        // --- burger ---
        const toggle = document.createElement("button")
        toggle.className = "menu-toggle item"
        toggle.type = "button"
        toggle.id = "menu-toggle"
        toggle.setAttribute("aria-label", "Abrir menú")
        toggle.setAttribute("aria-expanded", "false")
        const icMenu = icon("menu", { size: 26 })
        if (icMenu) toggle.appendChild(icMenu)

        // En modo hash el burger despliega los links. En modo paginas lo
        // abre layout.js para mostrar el menu fullscreen.
        if (this.modoHash) {
            toggle.addEventListener("click", () => {
                const abierto = header.classList.toggle("navbar--menu-abierto")
                toggle.setAttribute("aria-expanded", abierto ? "true" : "false")
            })
        }

        header.append(logo, nav, derecha, toggle)
        bloque.appendChild(header)

        if (!this.modoHash) bloque.appendChild(this._crearMenuFullscreen())

        this.element = bloque
        return bloque
    }
}

export default Navbar

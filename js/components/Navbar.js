const LINKS_CLIENTE = [
    { id: "index-i", nombre: "Inicio", pagina: "index.html" },
    { id: "menu-i", nombre: "Menú", pagina: "menu.html" },
    { id: "nosotros-i", nombre: "Nosotros", pagina: "nosotros.html" },
    { id: "contacto-i", nombre: "Contacto", pagina: "contacto.html" }
]

const LINKS_ADMIN = [
    { nombre: "Carta", pagina: "panel-carta.html", name: "carta" },
    { nombre: "Reservas", pagina: "panel-reservas.html", name: "reservas" },
    { nombre: "Mensajes", pagina: "panel-mensajes.html", name: "mensajes" },
    { nombre: "Pedidos", pagina: "panel-pedidos.html", name: "pedidos" },
    { nombre: "Usuarios", pagina: "panel-usuarios.html", name: "usuarios" }
]

const ICONO_CERRAR = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M16 8L8 16M8.00001 8L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`

const ICONO_MENU = `
    <svg width="38px" height="38px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g id="Menu / Menu_Alt_05">
            <path id="Vector" d="M5 17H13M5 12H19M11 7H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
    </svg>
`

const ICONO_CARRITO = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M3 3H5L7.2 14.5C7.4 15.4 8.2 16 9.1 16H17.8C18.7 16 19.5 15.4 19.7 14.5L21 7H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="9" cy="20" r="1.5" fill="currentColor"/>
        <circle cx="18" cy="20" r="1.5" fill="currentColor"/>
    </svg>
`

class Navbar {
    constructor({ session = null, root = "/", onSalir = null, mostrarCarrito = false } = {}) {
        this.session = session
        this.root = root
        this.onSalir = typeof onSalir === "function" ? onSalir : null
        this.esAdmin = root === "../"
        this.mostrarCarrito = mostrarCarrito
        this.element = null
    }

    _href(pagina) {
        return this.root + pagina
    }

    _crearEnlaceMenuPantalla(link) {
        const a = document.createElement("a")
        a.className = "item a"
        if (link.id) a.id = link.id
        if (link.name) a.setAttribute("name", link.name)
        if (this.esAdmin) a.classList.add("act")
        a.href = this._href(link.pagina)
        a.textContent = link.nombre
        return a
    }

    _crearEnlaceHeader(link) {
        const a = document.createElement("a")
        a.className = "item"
        if (link.name) a.setAttribute("name", link.name)
        a.href = this._href(link.pagina)
        a.textContent = link.nombre
        return a
    }

    _crearBotonSalir() {
        const boton = document.createElement("button")
        boton.type = "button"
        boton.className = "logout-btn"
        boton.textContent = "Cerrar Sesión"
        if (this.onSalir) {
            boton.addEventListener("click", this.onSalir)
        }
        return boton
    }

    _crearBotonCarrito() {
        const boton = document.createElement("button")
        boton.type = "button"
        boton.id = "abrir-carrito"
        boton.className = "boton-carrito"
        boton.setAttribute("aria-label", "Abrir carrito")
        boton.innerHTML = ICONO_CARRITO
        const cantidad = document.createElement("span")
        cantidad.className = "cantidad-carrito"
        cantidad.id = "cantidad-carrito"
        cantidad.textContent = "0"
        boton.appendChild(cantidad)
        return boton
    }

    _crearBotonReserva() {
        const caja = document.createElement("div")
        caja.className = "btn"
        const a = document.createElement("a")
        a.href = this._href("reserva.html")
        a.textContent = "Reservar ahora"
        caja.appendChild(a)
        return caja
    }

    _crearMenuFullscreen() {
        const seccion = document.createElement("section")
        seccion.className = "menu-fullscreen glass"
        seccion.id = "menu"

        const cerrar = document.createElement("button")
        cerrar.type = "button"
        cerrar.className = "exis item"
        cerrar.setAttribute("aria-label", "Cerrar menú")
        cerrar.innerHTML = ICONO_CERRAR

        const logo = document.createElement("a")
        logo.className = "nav-logo item"
        logo.href = this.esAdmin ? "../" : this._href("index.html")
        logo.textContent = "Rodilla"

        const lista = document.createElement("div")
        lista.className = "menu-list"

        const links = this.esAdmin ? LINKS_ADMIN : LINKS_CLIENTE
        links.forEach(link => lista.appendChild(this._crearEnlaceMenuPantalla(link)))

        if (this.esAdmin) {
            lista.appendChild(this._crearBotonSalir())
        } else {
            const reserva = document.createElement("div")
            reserva.className = "btn active a"
            reserva.id = "reserva-i"
            const a = document.createElement("a")
            a.href = this._href("reserva.html")
            a.textContent = "Reservar ahora"
            reserva.appendChild(a)
            lista.appendChild(reserva)
            if (this.session) {
                lista.appendChild(this._crearBotonSalir())
            }
        }

        seccion.append(cerrar, logo, lista)
        return seccion
    }

    _crearHeader() {
        const header = document.createElement("header")
        header.className = "navbar glass"

        const logo = document.createElement("a")
        logo.className = "nav-logo item"
        logo.href = this.esAdmin ? "../" : this._href("index.html")
        logo.textContent = "Rodilla"

        const nav = document.createElement("nav")
        nav.className = "nav-menu"
        const links = this.esAdmin ? LINKS_ADMIN : LINKS_CLIENTE
        links.forEach(link => nav.appendChild(this._crearEnlaceHeader(link)))

        header.appendChild(logo)
        header.appendChild(nav)

        if (this.esAdmin) {
            header.appendChild(this._crearBotonSalir())
        } else {
            const derecha = document.createElement("div")
            derecha.className = "right"
            derecha.appendChild(this._crearBotonReserva())
            if (this.session) {
                if (this.mostrarCarrito) {
                    derecha.appendChild(this._crearBotonCarrito())
                }
                derecha.appendChild(this._crearBotonSalir())
            }
            header.appendChild(derecha)
        }

        const toggle = document.createElement("button")
        toggle.type = "button"
        toggle.className = "menu-toggle item"
        toggle.id = "menu-toggle"
        toggle.setAttribute("aria-label", "Abrir menú")
        toggle.innerHTML = ICONO_MENU
        header.appendChild(toggle)

        return header
    }

    render() {
        const bloque = document.createElement("div")
        bloque.className = "block-menu"
        bloque.appendChild(this._crearMenuFullscreen())
        bloque.appendChild(this._crearHeader())
        this.element = bloque
        return bloque
    }
}

export { Navbar }
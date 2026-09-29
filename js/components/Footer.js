/* ==========================================================================
   FOOTER
   --------------------------------------------------------------------------
   Dos modos, por el mismo motivo que el Navbar:

   modo "hash"    → footer nuevo, en columnas, para la landing.

   modo "paginas" → footer simple de siempre, identico al anterior, para que
                    los ~15 HTML antiguos no cambien ni un pixel. El CSS de
                    navigation.css sigue expecting .copy y .footer-btn, y el
                    layout.js sigue pasando root y copyHref.

   El modo se decide solo: si te pasan root, es modo paginas.
   ========================================================================== */

const REDES = [
    { id: "facebook", nombre: "Facebook", url: "https://facebook.com/rodilla" },
    { id: "instagram", nombre: "Instagram", url: "https://instagram.com/rodilla" },
    { id: "whatsapp", nombre: "WhatsApp", url: "https://wa.me/51999999999" },
]

const EMAIL = "hola@rodilla.pe"
const DIRECCION = "Av. Principal 123, Ica"

class Footer {
    constructor({ root = null, copyHref = null } = {}) {
        this.root = root
        this.modoHash = !root
        this.copyHref = copyHref || (root ? root + "index.html" : "/")
        this.element = null
    }

    /* ---------------- modo paginas: el footer de siempre ---------------- */
    _crearCopyright() {
        const copia = document.createElement("div")
        copia.className = "copy glass"
        const a = document.createElement("a")
        a.href = this.copyHref
        a.textContent = "© 2026 Rodilla"
        copia.appendChild(a)
        return copia
    }

    _crearBotonSocial(red) {
        const enlace = document.createElement("a")
        enlace.href = red.url
        enlace.target = "_blank"
        enlace.rel = "noopener noreferrer"
        const boton = document.createElement("button")
        boton.type = "button"
        boton.className = "footer-btn glass"
        boton.id = red.id
        boton.setAttribute("aria-label", red.nombre)
        boton.textContent = red.nombre.charAt(0)
        enlace.appendChild(boton)
        return enlace
    }

    _renderPaginas() {
        const footer = document.createElement("footer")
        footer.appendChild(this._crearCopyright())
        REDES.forEach(red => footer.appendChild(this._crearBotonSocial(red)))
        return footer
    }

    /* ---------------- modo hash: footer en columnas ---------------- */
    _columna(titulo, items) {
        const col = document.createElement("div")
        col.className = "footer__col"
        const h = document.createElement("h2")
        h.className = "footer__titulo"
        h.textContent = titulo
        const ul = document.createElement("ul")
        ul.className = "footer__lista"
        for (const item of items) {
            const li = document.createElement("li")
            const a = document.createElement("a")
            a.href = item.href
            if (item.externo) {
                a.target = "_blank"
                a.rel = "noopener noreferrer"
            }
            a.textContent = item.texto
            li.appendChild(a)
            ul.appendChild(li)
        }
        col.append(h, ul)
        return col
    }

    _renderHash() {
        const footer = document.createElement("footer")
        footer.className = "footer footer--nuevo"

        const marca = document.createElement("div")
        marca.className = "footer__marca"
        const logo = document.createElement("a")
        logo.className = "footer__logo"
        logo.href = "#/"
        logo.textContent = "Rodilla"
        const tag = document.createElement("p")
        tag.className = "footer__tagline"
        tag.textContent = "Cafetería de especialidad"
        marca.append(logo, tag)

        const nav = this._columna("Navegación", [
            { texto: "Inicio", href: "#/" },
            { texto: "Menú", href: "#/menu" },
            { texto: "Reservas", href: "#/reservas" },
            { texto: "Nosotros", href: "#/nosotros" },
            { texto: "Contacto", href: "#/contacto" },
        ])

        const cuenta = this._columna("Cuenta", [
            { texto: "Iniciar sesión", href: "/auth.html#/login" },
            { texto: "Crear cuenta", href: "/auth.html#/register" },
            { texto: "Mi panel", href: "/dashboard.html" },
        ])

        // contacto: email, direccion y redes
        const contacto = document.createElement("div")
        contacto.className = "footer__col"
        const hContacto = document.createElement("h2")
        hContacto.className = "footer__titulo"
        hContacto.textContent = "Contacto"
        const ulContacto = document.createElement("ul")
        ulContacto.className = "footer__lista"

        const liMail = document.createElement("li")
        const aMail = document.createElement("a")
        aMail.href = `mailto:${EMAIL}`
        aMail.textContent = EMAIL
        liMail.appendChild(aMail)
        ulContacto.appendChild(liMail)

        const liDir = document.createElement("li")
        const spanDir = document.createElement("span")
        spanDir.textContent = DIRECCION
        liDir.appendChild(spanDir)
        ulContacto.appendChild(liDir)

        const redes = document.createElement("li")
        redes.className = "footer__redes"
        for (const red of REDES) {
            const a = document.createElement("a")
            a.href = red.url
            a.target = "_blank"
            a.rel = "noopener noreferrer"
            a.setAttribute("aria-label", red.nombre)
            a.textContent = red.nombre
            redes.appendChild(a)
        }
        ulContacto.appendChild(redes)
        contacto.append(hContacto, ulContacto)

        const legal = document.createElement("p")
        legal.className = "footer__legal"
        legal.textContent = `© ${new Date().getFullYear()} Rodilla · Todos los derechos reservados`

        footer.append(marca, nav, cuenta, contacto, legal)
        return footer
    }

    render() {
        this.element = this.modoHash ? this._renderHash() : this._renderPaginas()
        return this.element
    }
}

export { Footer }
export default Footer

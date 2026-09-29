import { icono } from "./Icon.js"

class Modal {
    constructor({ title = "", body = "", actions = [], id = null, className = "", onClose = null } = {}) {
        this.title = title
        this.body = body
        this.actions = actions
        this.className = className
        this.onClose = onClose
        this.element = null
        this._crearElemento(id)
        this._vincularEscape()
    }

    _crearElemento(id) {
        const overlay = document.createElement("div")
        overlay.className = "modal-overlay glass"
        overlay.setAttribute("role", "dialog")
        overlay.setAttribute("aria-modal", "true")
        if (id) overlay.id = id

        const contenido = document.createElement("div")
        // glass-strong: el dialogo lleva texto sobre el overlay, necesita mas
        // cuerpo que una lamina decorativa como el navbar
        contenido.className = "modal-content glass glass-strong" + (this.className ? " " + this.className : "")

        const header = document.createElement("div")
        header.className = "modal-header"
        const titulo = document.createElement("h2")
        titulo.textContent = this.title
        const cerrar = document.createElement("button")
        cerrar.type = "button"
        cerrar.className = "modal-close"
        cerrar.setAttribute("aria-label", "Cerrar modal")
        cerrar.innerHTML = icono("x", { size: 24 })
        header.append(titulo, cerrar)

        const cuerpo = document.createElement("div")
        cuerpo.className = "modal-body"
        this._rellenar(cuerpo, this.body)

        const pie = document.createElement("div")
        pie.className = "modal-footer"
        this.actions.forEach(accion => pie.appendChild(this._crearBotonAccion(accion)))

        contenido.append(header, cuerpo, pie)
        overlay.appendChild(contenido)

        cerrar.addEventListener("click", () => this.close())
        overlay.addEventListener("click", evento => {
            if (evento.target === overlay) this.close()
        })

        this.element = overlay
        this.tituloEl = titulo
        this.cuerpoEl = cuerpo
    }

    _crearBotonAccion(accion) {
        const boton = document.createElement("button")
        boton.type = "button"
        boton.textContent = accion.label || ""
        if (accion.className) boton.className = accion.className
        if (typeof accion.onClick === "function") {
            boton.addEventListener("click", () => accion.onClick(this, boton))
        }
        return boton
    }

    _rellenar(contenedor, contenido) {
        contenedor.innerHTML = ""
        if (contenido instanceof Node) {
            contenedor.appendChild(contenido)
        } else {
            contenedor.innerHTML = contenido
        }
    }

    _vincularEscape() {
        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape" && this.element?.classList.contains("active")) {
                this.close()
            }
        })
    }

    setTitle(titulo) {
        this.title = titulo
        if (this.tituloEl) this.tituloEl.textContent = titulo
    }

    setBody(contenido) {
        this.body = contenido
        if (this.cuerpoEl) this._rellenar(this.cuerpoEl, contenido)
    }

    open() {
        if (!this.element.isConnected) {
            document.body.appendChild(this.element)
        }
        this.element.classList.remove("fade-out")
        this.element.classList.add("active")
        document.body.classList.add("sin-scroll")
    }

    close() {
        if (!this.element || !this.element.classList.contains("active")) return
        this.element.classList.add("fade-out")
        if (typeof this.onClose === "function") this.onClose()
        setTimeout(() => {
            this.element.classList.remove("active", "fade-out")
            document.body.classList.remove("sin-scroll")
        }, 300)
    }
}

export { Modal }
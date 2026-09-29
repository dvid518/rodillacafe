import { icon } from "./Icon.js"

class Loading {
    constructor({ mensaje = "Cargando..." } = {}) {
        this.mensaje = mensaje
        this.element = null
    }

    render() {
        const seccion = document.createElement("section")
        seccion.className = "glass loading"
        seccion.id = "loading"
        seccion.setAttribute("aria-label", this.mensaje)

        const titulo = document.createElement("h1")
        titulo.textContent = this.mensaje

        // el atributo `spin` es la animacion propia de Reicon: sustituye al
        //keyframes rodilla-spin que antes vivia en modal.css
        seccion.append(titulo, icon("loader-circle", { size: 60, spin: true }))
        this.element = seccion
        return seccion
    }

    show(mensaje = this.mensaje) {
        if (!this.element) this.render()
        if (mensaje && mensaje !== this.mensaje) {
            this.mensaje = mensaje
            const titulo = this.element.querySelector("h1")
            if (titulo) titulo.textContent = mensaje
            this.element.setAttribute("aria-label", mensaje)
        }
        if (!this.element.isConnected) {
            document.body.appendChild(this.element)
        }
        this.element.classList.add("active")
    }

    hide() {
        if (!this.element) return
        this.element.classList.remove("active")
    }

    remove() {
        if (this.element) this.element.remove()
        this.element = null
    }
}

export { Loading }
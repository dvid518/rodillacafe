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

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("viewBox", "0 0 24 24")
        svg.setAttribute("fill", "none")
        svg.setAttribute("aria-hidden", "true")
        const circulo = document.createElementNS("http://www.w3.org/2000/svg", "path")
        circulo.setAttribute("d", "M12 3C7.03 3 3 7.03 3 12")
        circulo.setAttribute("stroke", "currentColor")
        circulo.setAttribute("stroke-width", "7")
        circulo.setAttribute("stroke-linecap", "round")
        svg.appendChild(circulo)

        seccion.append(titulo, svg)
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
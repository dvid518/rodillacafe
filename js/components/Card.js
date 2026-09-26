class Card {
    constructor({ producto = {}, categoria = "", onAgregar = null } = {}) {
        this.producto = producto
        this.categoria = categoria
        this.onAgregar = typeof onAgregar === "function" ? onAgregar : null
        this.element = null
    }

    render() {
        const tarjeta = document.createElement("div")
        tarjeta.className = `card-producto ${this.categoria} glass`

        const imagen = document.createElement("img")
        imagen.src = this.producto.img || ""
        imagen.alt = this.producto.nombre || "Producto"
        imagen.loading = "lazy"

        const nombre = document.createElement("h4")
        nombre.textContent = this.producto.nombre || "Producto"

        const precio = document.createElement("p")
        precio.className = "precio"
        precio.textContent = `S/ ${Number(this.producto.precio || 0).toFixed(2)}`

        const boton = document.createElement("button")
        boton.type = "button"
        boton.className = "btn-agregar"
        boton.textContent = "Agregar al carrito"
        if (this.onAgregar) {
            boton.addEventListener("click", () => this.onAgregar(this.producto, boton))
        } else {
            boton.dataset.producto = encodeURIComponent(JSON.stringify(this.producto))
        }

        tarjeta.append(imagen, nombre, precio, boton)
        this.element = tarjeta
        return tarjeta
    }
}

export { Card }
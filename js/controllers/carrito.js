import { opcionalSesion } from "../session/opcionalSesion.js"
import { orderService } from "../services/orderService.js"
import { formatearPrecio, escaparHTML } from "../utils/format.js"
import { Modal } from "../components/Modal.js"
import { notifyInfo, notifyWarning, notifyError, notifySuccess } from "../utils/notify.js"

const CLAVE_CARRITO = "rodilla_carrito"
let carrito = obtenerCarritoGuardado()

function obtenerCarritoGuardado() {
    try {
        const carritoGuardado = localStorage.getItem(CLAVE_CARRITO)
        return carritoGuardado ? JSON.parse(carritoGuardado) : []
    } catch (error) {
        console.error("No se pudo leer el carrito:", error)
        return []
    }
}

function guardarCarrito() {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito))
    actualizarCarrito()
}

function crearCarritoHTML() {
    if (document.getElementById("carrito-panel")) {
        return
    }

    const overlay = document.createElement("div")
    overlay.id = "carrito-overlay"
    overlay.className = "carrito-overlay"

    const panel = document.createElement("aside")

    panel.id = "carrito-panel"
    panel.className = "carrito-panel"

    panel.innerHTML = `
        <div class="carrito-header">

            <div>
                <h2>Carrito</h2>
                <p>
                    Productos seleccionados
                </p>
            </div>

            <button
                type="button"
                id="cerrar-carrito"
                class="cerrar-carrito"
                aria-label="Cerrar carrito"
            >
                ×
            </button>

        </div>

        <div
            id="lista-carrito"
            class="lista-carrito"
        ></div>

        <div class="carrito-footer">
            <div class="total-carrito">
                <span>Total:</span>
                <strong id="total-carrito">
                    S/ 0.00
                </strong>
            </div>
            <button type="button" id="seguir-comprando" class="seguir-comprando">
                Seguir comprando
            </button>
            <button type="button" id="vaciar-carrito" class="vaciar-carrito">
                Vaciar carrito
            </button>
            <button type="button" id="realizar-pedido" class="realizar-pedido">
                Realizar pedido
            </button>

        </div>
    `

    document.body.appendChild(overlay)
    document.body.appendChild(panel)

    configurarEventosCarrito()
}

function agregarProducto(producto) {
    if (!producto || !producto.nombre) {
        console.error("El producto no tiene los datos necesarios.")
        return
    }

    const idProducto = String(
        producto.id ||
        producto.nombre
            .trim()
            .toLowerCase()
            .replaceAll(" ", "-")
    )

    const productoExistente = carrito.find(item => String(item.id) === idProducto)

    if (productoExistente) {
        productoExistente.cantidad += 1
    } else {
        carrito.push({
            id: idProducto,
            nombre: producto.nombre,
            precio: Number(producto.precio || 0),
            img: producto.img || "",
            categoria: producto.categoria || "",
            cantidad: 1
        })
    }

    guardarCarrito()
    abrirCarrito()
}

function cambiarCantidad(id, cambio) {
    const producto = carrito.find(item => String(item.id) === String(id))
    if (!producto) return
    producto.cantidad += cambio
    if (producto.cantidad <= 0) {
        eliminarProducto(id)
        return
    }
    guardarCarrito()
}

function eliminarProducto(id) {
    carrito = carrito.filter(item => String(item.id) !== String(id))
    guardarCarrito()
}

let modalVaciar = null

function getModalVaciar() {
    if (!modalVaciar) {
        modalVaciar = new Modal({
            title: "Vaciar carrito",
            body: "<p>¿Deseas eliminar todos los productos del carrito?</p>",
            actions: [
                { label: "Cancelar", className: "cancel-btn", onClick: m => m.close() },
                {
                    label: "Vaciar",
                    className: "delete-btn",
                    onClick: m => {
                        carrito = []
                        guardarCarrito()
                        m.close()
                        notifyInfo("Carrito vaciado")
                    }
                }
            ]
        })
    }
    return modalVaciar
}

function vaciarCarrito() {
    if (carrito.length === 0) return
    getModalVaciar().open()
}

function obtenerTotal() {
    return carrito.reduce((total, producto) => {
        return total + (Number(producto.precio) * Number(producto.cantidad))
    }, 0)
}

function obtenerCantidadTotal() {
    return carrito.reduce((total, producto) => { return total + Number(producto.cantidad) }, 0)
}

function crearProductoCarrito(producto) {
    const subtotal = Number(producto.precio) * Number(producto.cantidad)

    return `
        <article class="carrito-item">

            <img src="${escaparHTML(producto.img)}" alt="${escaparHTML(producto.nombre)}">
            <div class="carrito-item-info">
                <h4>
                    ${escaparHTML(producto.nombre)}
                </h4>
                <p>
                    S/ ${formatearPrecio(producto.precio)}
                    por unidad
                </p>
                <div class="control-cantidad">
                    <button
                        type="button"
                        class="btn-cantidad"
                        data-accion="restar"
                        data-id="${escaparHTML(producto.id)}"
                    >
                        −
                    </button>

                    <span>
                        ${producto.cantidad}
                    </span>

                    <button
                        type="button"
                        class="btn-cantidad"
                        data-accion="sumar"
                        data-id="${escaparHTML(producto.id)}"
                    >
                        +
                    </button>

                </div>

            </div>

            <div class="carrito-item-final">

                <strong>
                    S/ ${formatearPrecio(subtotal)}
                </strong>

                <button
                    type="button"
                    class="btn-eliminar-producto"
                    data-id="${escaparHTML(producto.id)}"
                >
                    Eliminar
                </button>

            </div>

        </article>
    `
}

function actualizarCarrito() {
    const lista = document.getElementById("lista-carrito")
    const cantidad = document.getElementById("cantidad-carrito")
    const total = document.getElementById("total-carrito")
    const botonVaciar = document.getElementById("vaciar-carrito")
    const botonPedido = document.getElementById("realizar-pedido")

    if (cantidad) {
        cantidad.textContent = obtenerCantidadTotal()
    }
    if (total) {
        total.textContent = `S/ ${formatearPrecio(obtenerTotal())}`
    }
    if (!lista) {
        return
    }
    if (carrito.length === 0) {
        lista.innerHTML = `
            <div class="carrito-vacio">
                <div class="carrito-vacio-icono">
                    🛒
                </div>
                <h3>
                    Tu carrito está vacío
                </h3>
                <p>
                    Visita el menú y agrega los productos
                    que deseas pedir.
                </p>
                <a
                    href="menu.html"
                    class="ir-menu-carrito"
                >
                    Ver el menú
                </a>
            </div>
        `

        if (botonVaciar) {
            botonVaciar.disabled = true
        }
        if (botonPedido) {
            botonPedido.disabled = true
        }
        return
    }

    lista.innerHTML = carrito.map(crearProductoCarrito).join("")

    if (botonVaciar) {
        botonVaciar.disabled = false
    }
    if (botonPedido) {
        botonPedido.disabled = false
    }
}

function abrirCarrito() {
    const panel = document.getElementById("carrito-panel")
    const overlay = document.getElementById("carrito-overlay")

    if (panel) {
        panel.classList.add("abierto")
    }
    if (overlay) {
        overlay.classList.add("visible")
    }
    document.body.classList.add("sin-scroll")
}

function cerrarCarrito() {
    const panel = document.getElementById("carrito-panel")
    const overlay = document.getElementById("carrito-overlay")

    if (panel) {
        panel.classList.remove("abierto")
    }
    if (overlay) {
        overlay.classList.remove("visible")
    }
    document.body.classList.remove("sin-scroll")
}

async function realizarPedido() {
    if (carrito.length === 0) {
        return
    }
    const sesion = await opcionalSesion()
    if (sesion === null) {
        notifyWarning("Inicia sesión para realizar un pedido", 3500)
        setTimeout(() => {
            window.location.href = "/login.html?redirect=/menu.html"
        }, 1500)
        return
    }
    try {
        const productos = carrito.map(producto => ({
            id_producto: Number(producto.id),
            cantidad: Number(producto.cantidad),
            precio: Number(producto.precio)
        }))
        const resultado = await orderService.crearPedido(productos, obtenerTotal())
        if (!resultado.ok) {
            console.error("Error al registrar pedido:", resultado.error)
            notifyError("No se pudo registrar el pedido. Intenta de nuevo.")
            return
        }
        notifySuccess("Pedido realizado correctamente", 2500)
        carrito = []
        guardarCarrito()
        cerrarCarrito()
        setTimeout(() => {
            window.location.href = "/mis-pedidos.html"
        }, 1200)
    } catch (error) {
        console.error("Error al guardar pedido:", error)
        notifyError("No se pudo registrar el pedido.")
    }
}

function configurarEventosCarrito() {
    document.getElementById("cerrar-carrito")?.addEventListener("click", cerrarCarrito)
    document.getElementById("carrito-overlay")?.addEventListener("click", cerrarCarrito)
    document.getElementById("seguir-comprando")?.addEventListener("click", cerrarCarrito)
    document.getElementById("vaciar-carrito")?.addEventListener("click", vaciarCarrito)
    document.getElementById("realizar-pedido")?.addEventListener("click", realizarPedido)

    document.addEventListener("click", function (evento) {
        const botonCarrito = evento.target.closest(".boton-carrito")
        const botonCantidad = evento.target.closest(".btn-cantidad")
        const botonEliminar = evento.target.closest(".btn-eliminar-producto")

        if (botonCarrito) {
            abrirCarrito()
        }
        if (botonCantidad) {
            const accion = botonCantidad.dataset.accion
            const cambio = accion === "sumar" ? 1 : -1
            cambiarCantidad(botonCantidad.dataset.id, cambio)
        }
        if (botonEliminar) {
            eliminarProducto(botonEliminar.dataset.id)
        }
    })

    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape") {
            cerrarCarrito()
        }
    })

    document.addEventListener("rodilla:navegacion", function () {
        actualizarCarrito()
    })

    window.addEventListener("storage", function (evento) {
        if (evento.key === CLAVE_CARRITO) {
            carrito = obtenerCarritoGuardado()
            actualizarCarrito()
        }
    })
}

function iniciarCarrito() {
    crearCarritoHTML()
    actualizarCarrito()
}

export const carritoRodilla = {
    agregarProducto,
    abrirCarrito,
    cerrarCarrito,
    actualizarCarrito,
    obtenerProductos: function () {
        return [...carrito]
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarCarrito)
} else {
    iniciarCarrito()
}
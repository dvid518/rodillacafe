import { guardRol } from "../session/roleGuard.js"
import { orderService } from "../services/orderService.js"
import { Modal } from "../components/Modal.js"
import { notifyError, notifySuccess } from "../utils/notify.js"

const LABEL_ESTADO = {
    P: "Pendiente",
    A: "Aprobado",
    F: "Completado",
    X: "Anulado"
}

let esAdmin = false

function formatearFecha(iso) {
    if (!iso) return "-"
    const fecha = new Date(iso)
    return fecha.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
}

function datosCliente(pedido) {
    const logeo = pedido?.USUARIO?.[0]?.Logeo
    return { nombre: logeo || "-", telefono: "-" }
}

function crearFila(pedido) {
    const cliente = datosCliente(pedido)
    const botonEliminar = esAdmin ? `
        <td class="icon trash">
            <button class="btn-delete" data-id="${pedido.ID_Pedido}">
                <svg class="trash" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"/>
                </svg>
            </button>
        </td>
    ` : ""

    return `
        <tr>
            <td>${pedido.Numero_Pedido || pedido.ID_Pedido}</td>
            <td>${cliente.nombre}</td>
            <td>${cliente.telefono}</td>
            <td>S/ ${Number(pedido.Total || 0).toFixed(2)}</td>
            <td>${LABEL_ESTADO[pedido.Situacion] || pedido.Situacion}</td>
            <td class="icon">
                <button class="btn-view" data-id="${pedido.ID_Pedido}">
                    Ver más
                </button>
            </td>
            ${botonEliminar}
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("pedidos-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(pedido => crearFila(pedido)).join("")

    tbody.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            deletePedido(btn.dataset.id)
        })
    })
    tbody.querySelectorAll(".btn-view").forEach(btn => {
        btn.addEventListener("click", () => {
            verPedido(btn.dataset.id)
        })
    })
}

async function iniciarPanel() {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return
    esAdmin = roles.includes("ADMINISTRADOR")
    try {
        const resultado = await orderService.listarTodos()
        if (!resultado.ok) {
            console.error("Error al cargar pedidos:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar pedidos:", error)
    }
}

const cuerpoDelete = document.createElement("div")
cuerpoDelete.innerHTML = `
    <p>¿Estás seguro de que deseas eliminar este pedido?</p>
    <div class="product-info">
        <span id="pedidoNombre"></span>
        <span id="pedidoDetalle"></span>
    </div>
    <p class="warning-text">Esta acción no se puede deshacer.</p>
`

const deleteModal = new Modal({
    title: "Confirmar eliminación",
    actions: [
        { label: "Cancelar", className: "cancel-btn", onClick: () => { pendingDelete = null; deleteModal.close() } },
        { label: "Eliminar", className: "delete-btn", onClick: () => {
            if (pendingDelete) {
                executeDelete(pendingDelete)
                pendingDelete = null
            }
        } }
    ]
})
deleteModal.setBody(cuerpoDelete)

const pedidoNombre = cuerpoDelete.querySelector("#pedidoNombre")
const pedidoDetalle = cuerpoDelete.querySelector("#pedidoDetalle")

const cuerpoDetalle = document.createElement("div")
cuerpoDetalle.innerHTML = `
    <p><strong>Cliente:</strong> <span id="dNombre"></span></p>
    <p><strong>Teléfono:</strong> <span id="dTelefono"></span></p>
    <p><strong>Total:</strong> S/ <span id="dTotal"></span></p>
    <h3>Productos</h3>
    <div id="dProductos"></div>
`

const detailModal = new Modal({
    title: "Detalle del pedido",
    className: "detail-modal",
    actions: [
        { label: "Marcar como completado", className: "accept-btn", onClick: completarPedido },
        { label: "Cerrar", className: "cancel-btn", onClick: () => detailModal.close() }
    ]
})
detailModal.setBody(cuerpoDetalle)

const btnCompletar = detailModal.element.querySelector(".accept-btn")
const dNombre = cuerpoDetalle.querySelector("#dNombre")
const dTelefono = cuerpoDetalle.querySelector("#dTelefono")
const dTotal = cuerpoDetalle.querySelector("#dTotal")
const dProductos = cuerpoDetalle.querySelector("#dProductos")

let listaPedidos = []
let pedidoActual = null
let pendingDelete = null

async function deletePedido(id) {
    const resultado = await orderService.listarTodos()
    if (!resultado.ok) return
    const pedido = resultado.data.find(p => String(p.ID_Pedido) === String(id))
    if (!pedido) return

    pedidoNombre.textContent = (pedido.Numero_Pedido || id)
    pedidoDetalle.textContent = `S/ ${Number(pedido.Total || 0).toFixed(2)}`
    pendingDelete = id
    deleteModal.open()
}

async function executeDelete(id) {
    try {
        const resultado = await orderService.eliminarPedido(id)
        if (!resultado.ok) {
            console.error("Error al eliminar pedido:", resultado.error)
            notifyError("Error al eliminar el pedido")
            return
        }
        notifySuccess("Pedido eliminado correctamente")
        iniciarPanel()
    } catch (error) {
        console.error("Error al eliminar pedido:", error)
        notifyError("Error al eliminar el pedido")
    }
}

async function verPedido(id) {
    if (!listaPedidos.length) {
        const resultado = await orderService.listarTodos()
        if (!resultado.ok) return
        listaPedidos = resultado.data || []
    }
    const pedido = listaPedidos.find(p => String(p.ID_Pedido) === String(id))
    if (!pedido) return

    pedidoActual = id
    const cliente = datosCliente(pedido)

    dNombre.textContent = cliente.nombre
    dTelefono.textContent = cliente.telefono
    dTotal.textContent = Number(pedido.Total || 0).toFixed(2)

    const detalle = pedido.DETALLE_PEDIDO || []
    dProductos.innerHTML = detalle.map(producto => `
        <div class="producto-item">
            <strong>${producto.PRODUCTO?.[0]?.N_Producto || "Producto " + producto.ID_Producto}</strong>
            <span>
                ${Number(producto.Cantidad || 0)} ×
                S/ ${Number(producto.Precio || 0).toFixed(2)}
            </span>
        </div>
    `).join("") || "<p>Sin productos</p>"

    btnCompletar.classList.toggle("hidden", !(pedido.Situacion === "P" || pedido.Situacion === "A"))
    detailModal.open()
}

async function completarPedido() {
    if (!pedidoActual) return
    const resultado = await orderService.actualizarEstado(pedidoActual, "F")
    if (!resultado.ok) {
        console.error("Error al completar pedido:", resultado.error)
        notifyError("No se pudo completar el pedido")
        return
    }
    notifySuccess("Pedido completado")
    detailModal.close()
    iniciarPanel()
}

iniciarPanel()
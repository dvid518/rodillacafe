import "./../session/guard.js"
import { orderService } from "../services/orderService.js"
import { Modal } from "../components/Modal.js"

const LABEL_ESTADO = {
    P: "Pendiente",
    A: "Aprobado",
    F: "Completado",
    X: "Anulado"
}

function formatearFecha(iso) {
    if (!iso) return "-"
    const fecha = new Date(iso)
    return fecha.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
}

function nombreCliente(pedido) {
    return pedido?.USUARIO?.[0]?.Logeo || null
}

function crearFila(pedido) {
    return `
        <tr>
            <td>${pedido.Numero_Pedido || pedido.ID_Pedido}</td>
            <td>${formatearFecha(pedido.F_Pedido)}</td>
            <td>S/ ${Number(pedido.Total || 0).toFixed(2)}</td>
            <td>${LABEL_ESTADO[pedido.Situacion] || pedido.Situacion}</td>
            <td class="icon">
                <button class="btn-view" data-id="${pedido.ID_Pedido}">
                    Ver más
                </button>
            </td>
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("pedidos-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(pedido => crearFila(pedido)).join("")
    tbody.querySelectorAll(".btn-view").forEach(btn => {
        btn.addEventListener("click", () => {
            verPedido(btn.dataset.id)
        })
    })
}

const detailModal = new Modal({
    title: "Detalle del pedido",
    className: "detail-modal",
    actions: [
        { label: "Cerrar", className: "cancel-btn", onClick: modal => modal.close() }
    ]
})

const cuerpoDetalle = document.createElement("div")
cuerpoDetalle.innerHTML = `
    <p><strong>Pedido:</strong> <span id="dNumero"></span></p>
    <p><strong>Fecha:</strong> <span id="dFecha"></span></p>
    <p><strong>Total:</strong> S/ <span id="dTotal"></span></p>
    <h3>Productos</h3>
    <div id="dProductos"></div>
`
detailModal.setBody(cuerpoDetalle)

const dNumero = cuerpoDetalle.querySelector("#dNumero")
const dFecha = cuerpoDetalle.querySelector("#dFecha")
const dTotal = cuerpoDetalle.querySelector("#dTotal")
const dProductos = cuerpoDetalle.querySelector("#dProductos")

let pedidoActual = null

async function verPedido(id) {
    const resultado = await orderService.listarMisPedidos()
    if (!resultado.ok) return
    const pedido = resultado.data.find(p => String(p.ID_Pedido) === String(id))
    if (!pedido) return

    pedidoActual = id

    const cliente = nombreCliente(pedido)
    dNumero.textContent = (cliente ? cliente + " · " : "") + (pedido.Numero_Pedido || id)
    dFecha.textContent = formatearFecha(pedido.F_Pedido)
    dTotal.textContent = Number(pedido.Total || 0).toFixed(2)

    const detalle = pedido.DETALLE_PEDIDO || []
    dProductos.innerHTML = detalle.map(item => `
        <div class="producto-item">
            <strong>${item.PRODUCTO?.[0]?.N_Producto || "Producto " + item.ID_Producto}</strong>
            <span>
                ${Number(item.Cantidad || 0)} ×
                S/ ${Number(item.Precio || 0).toFixed(2)}
            </span>
        </div>
    `).join("") || "<p>Sin productos</p>"

    detailModal.open()
}

async function iniciarPanel() {
    try {
        const resultado = await orderService.listarMisPedidos()
        if (!resultado.ok) {
            console.error("Error al cargar pedidos:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar pedidos:", error)
    }
}

iniciarPanel()
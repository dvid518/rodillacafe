import { guardRol } from "../../session/roleGuard.js"
import { orderService } from "../../services/orderService.js"
import { userService } from "../../services/userService.js"
import { productService } from "../../services/productService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import {
    ESTADO_PEDIDO, badge, filaVacia, filaError, opcionesEstado, monto,
    abrirModal, cerrarModal, cerrarConEscape, poblarClientes,
    mapaUsuarios, confirmarBorrado,
} from "./crud-comun.js"

const CELDAS = 8

export async function pedidosController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return

    const esAdmin = roles.includes("ADMINISTRADOR")

    const tbody = contenedor.querySelector("#pedidos-tbody")
    const modal = contenedor.querySelector("#pedidos-modal")
    const detalleModal = contenedor.querySelector("#pedidos-detalle-modal")
    const aviso = contenedor.querySelector("#pedidos-aviso")

    const titulo = modal.querySelector("#pedidos-modal-titulo")
    const selCliente = modal.querySelector("#pedidos-input-cliente")
    const selTipo = modal.querySelector("#pedidos-input-tipo")
    const selEstado = modal.querySelector("#pedidos-input-estado")
    const campoEstado = modal.querySelector("#pedidos-campo-estado")
    const inComensales = modal.querySelector("#pedidos-input-comensales")
    const inObservacion = modal.querySelector("#pedidos-input-observacion")
    const fieldsetItems = modal.querySelector("#pedidos-items-fieldset")
    const listaItems = modal.querySelector("#pedidos-items")
    const elTotal = modal.querySelector("#pedidos-total")
    const btnGuardar = modal.querySelector("#pedidos-modal-guardar")

    let pedidos = []
    let productos = []
    let clientes = []
    let tipos = []
    let usuariosPorId = new Map()
    let editandoId = null
    let idUsuarioActual = null

    /* ---------- carga ---------- */

    const [rPedidos, rProductos, rClientes, rTipos, rUsuarios, sesion] = await Promise.all([
        orderService.listarTodos(),
        productService.listarProductosAdmin(),
        userService.listarClientes(),
        orderService.listarTiposAtencion(),
        userService.listarUsuarios(),
        authService.obtenerSesion(),
    ])

    pedidos = rPedidos.ok ? rPedidos.data : []
    productos = rProductos.ok ? rProductos.data : []
    clientes = rClientes.ok ? rClientes.data : []
    tipos = rTipos.ok ? rTipos.data : []
    usuariosPorId = mapaUsuarios(rUsuarios.ok ? rUsuarios.data : [])
    idUsuarioActual = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    const perfil = await authService.obtenerPerfil()
    const miIdUsuario = perfil.ok ? perfil.data?.ID_Usuario : null

    /* Sin lista de clientes no se puede dar de alta un pedido: el desplegable
       vendria vacio. RLS solo deja leer CLIENTE a un admin, asi que esto le
       pasa al cajero, no es un caso raro. */
    const puedeCrear = esAdmin && clientes.length > 0 && tipos.length > 0

    if (!esAdmin) {
        contenedor.querySelectorAll(".js-solo-admin").forEach(el => el.remove())
    }
    if (esAdmin && clientes.length === 0) {
        aviso.hidden = false
        aviso.textContent = "No hay clientes visibles para tu cuenta: no puedes registrar pedidos manualmente."
    }

    poblarClientes(selCliente, clientes)
    selTipo.replaceChildren(...tipos.map(t => {
        const o = document.createElement("option")
        o.value = t.ID_TipoAtencion
        o.textContent = t.N_TipoAtencion
        return o
    }))
    selEstado.innerHTML = opcionesEstado(ESTADO_PEDIDO)

    /* ---------- tabla ---------- */

    function nombreDe(pedido) {
        const porUsuario = usuariosPorId.get(pedido.ID_Usuario)
        if (porUsuario) return porUsuario
        // sin permiso para leer USUARIO: se muestra el id, no un "-"
        if (pedido.ID_Cliente) return `Cliente #${pedido.ID_Cliente}`
        return "—"
    }

    function iconoBoton(nombre, accion, id, etiqueta, clase = "") {
        // icono(), no icon().outerHTML: el <svg> de Reicon vive en su shadow
        // root, asi que outerHTML de un <re-icon> recien creado sale vacio
        const svg = icono(nombre, { size: 16 })
        return `<button class="btn-icono ${clase}" type="button" data-accion="${accion}" data-id="${id}" title="${escaparHTML(etiqueta)}" aria-label="${escaparHTML(etiqueta)}">${svg}</button>`
    }

    function pintarTabla() {
        if (!rPedidos.ok) {
            tbody.innerHTML = filaError(CELDAS, "los pedidos")
            return
        }
        if (!pedidos.length) {
            tbody.innerHTML = filaVacia(CELDAS, "Todavía no hay pedidos")
            return
        }

        const lista = [...pedidos].sort((a, b) => (b.F_Pedido || "").localeCompare(a.F_Pedido || ""))
        tbody.innerHTML = lista.map(p => `
            <tr>
                <td>${escaparHTML(String(p.Numero_Pedido ?? p.ID_Pedido))}</td>
                <td>${escaparHTML(nombreDe(p))}</td>
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(monto(p.Total))}</td>
                <td>${badge(ESTADO_PEDIDO, p.Situacion)}</td>
                <td>${iconoBoton("eye", "detalle", p.ID_Pedido, `Ver detalle del pedido ${p.Numero_Pedido ?? p.ID_Pedido}`)}</td>
                <td>${iconoBoton("pencil", "editar", p.ID_Pedido, `Editar pedido ${p.Numero_Pedido ?? p.ID_Pedido}`)}</td>
                <td>${esAdmin ? iconoBoton("trash-2", "eliminar", p.ID_Pedido, `Eliminar pedido ${p.Numero_Pedido ?? p.ID_Pedido}`, "btn-icono--peligro") : ""}</td>
            </tr>
        `).join("")
    }

    /* ---------- detalle ---------- */

    function verDetalle(id) {
        const pedido = pedidos.find(p => String(p.ID_Pedido) === String(id))
        if (!pedido) return
        const lineas = pedido.DETALLE_PEDIDO || []
        const cuerpo = contenedor.querySelector("#pedidos-detalle-contenido")
        cuerpo.innerHTML = `
            <dl class="detalle__datos">
                <div><dt>Cliente</dt><dd>${escaparHTML(nombreDe(pedido))}</dd></div>
                <div><dt>Fecha</dt><dd>${escaparHTML(formatearFecha(pedido.F_Pedido, { dateStyle: "medium", timeStyle: "short" }))}</dd></div>
                <div><dt>Comensales</dt><dd>${pedido.N_Comensales ?? "—"}</dd></div>
                <div><dt>Estado</dt><dd>${badge(ESTADO_PEDIDO, pedido.Situacion)}</dd></div>
            </dl>
            ${pedido.Observacion ? `<p class="detalle__obs"><strong>Observación:</strong> ${escaparHTML(pedido.Observacion)}</p>` : ""}
            <h3 class="detalle__titulo">Productos</h3>
            ${lineas.length ? lineas.map(d => `
                <div class="producto-item">
                    <span>${escaparHTML(d.PRODUCTO?.[0]?.N_Producto || `Producto ${d.ID_Producto}`)}</span>
                    <span>${d.Cantidad} × ${escaparHTML(monto(d.Precio))}</span>
                    <strong>${escaparHTML(monto(Number(d.Cantidad) * Number(d.Precio)))}</strong>
                </div>
            `).join("") : '<p class="vacio">Este pedido no tiene productos</p>'}
        `
        abrirModal(detalleModal)
    }

    /* ---------- lineas del formulario ---------- */

    function totalItems() {
        let suma = 0
        for (const fila of listaItems.querySelectorAll(".pedido-item")) {
            const sel = fila.querySelector(".item-producto")
            const cant = Number(fila.querySelector(".item-cantidad").value) || 0
            const precio = Number(sel.selectedOptions[0]?.dataset.precio || 0)
            suma += cant * precio
        }
        return suma
    }

    function pintarTotal() {
        elTotal.textContent = monto(totalItems())
    }

    function agregarItem() {
        const fila = document.createElement("div")
        fila.className = "pedido-item"
        const opciones = ['<option value="">Producto…</option>'].concat(
            [...productos]
                .sort((a, b) => a.N_Producto.localeCompare(b.N_Producto))
                .map(p => `<option value="${p.ID_Producto}" data-precio="${Number(p.Precio)}">${escaparHTML(p.N_Producto)} — ${escaparHTML(monto(p.Precio))}</option>`)
        ).join("")

        fila.innerHTML = `
            <select class="select item-producto">${opciones}</select>
            <input class="input item-cantidad" type="number" min="1" step="1" value="1" aria-label="Cantidad">
            <span class="pedido-item__subtotal">${escaparHTML(monto(0))}</span>
            <button class="btn-icono btn-icono--peligro item-quitar" type="button" title="Quitar línea" aria-label="Quitar línea">${icono("x", { size: 16 })}</button>
        `
        fila.querySelector(".item-producto").addEventListener("change", pintarTotal)
        fila.querySelector(".item-cantidad").addEventListener("input", pintarTotal)
        fila.querySelector(".item-quitar").addEventListener("click", () => {
            fila.remove()
            pintarTotal()
        })
        listaItems.appendChild(fila)
        pintarTotal()
    }

    /* ---------- modal ---------- */

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nuevo pedido"
        selCliente.value = ""
        selCliente.disabled = false
        selTipo.value = tipos[0]?.ID_TipoAtencion ?? ""
        selTipo.disabled = false
        inComensales.value = 1
        inObservacion.value = ""
        campoEstado.hidden = true
        fieldsetItems.hidden = false
        listaItems.replaceChildren()
        agregarItem()
        abrirModal(modal, selCliente)
    }

    function abrirEdicion(id) {
        const pedido = pedidos.find(p => String(p.ID_Pedido) === String(id))
        if (!pedido) return
        editandoId = id
        titulo.textContent = `Editar pedido #${pedido.Numero_Pedido ?? id}`
        selCliente.value = pedido.ID_Cliente ?? ""
        // el cliente y el tipo no se cambian despues: dar de alta otro pedido
        selCliente.disabled = true
        selTipo.value = pedido.ID_TipoAtencion ?? ""
        selTipo.disabled = true
        selEstado.value = pedido.Situacion || "P"
        campoEstado.hidden = false
        inComensales.value = pedido.N_Comensales ?? 1
        inObservacion.value = pedido.Observacion || ""
        // las lineas no se editan: hacerlo exigiria borrar y recrear el
        // detalle. Se cambian desde el pedido del cliente.
        fieldsetItems.hidden = true
        abrirModal(modal, selEstado)
    }

    async function guardar() {
        btnGuardar.disabled = true
        try {
            if (editandoId) {
                const situacion = selEstado.value
                const resultado = await orderService.actualizarPedido(editandoId, {
                    Situacion: situacion,
                    Observacion: inObservacion.value.trim(),
                    N_Comensales: Number(inComensales.value) || 1,
                })
                if (!resultado.ok) {
                    console.error("Error al actualizar pedido:", resultado.error)
                    return notifyError("No se pudo actualizar el pedido")
                }
                notifySuccess(`Pedido marcado como ${ESTADO_PEDIDO[situacion]?.toLowerCase() || situacion}`)
            } else {
                const idCliente = Number(selCliente.value)
                if (!idCliente) return notifyWarning("Selecciona un cliente")

                const items = [...listaItems.querySelectorAll(".pedido-item")]
                    .map(fila => {
                        const sel = fila.querySelector(".item-producto")
                        const cant = Number(fila.querySelector(".item-cantidad").value)
                        return {
                            ID_Producto: Number(sel.value),
                            Cantidad: cant,
                            Precio: Number(sel.selectedOptions[0]?.dataset.precio || 0),
                        }
                    })
                    .filter(it => it.ID_Producto)

                if (!items.length) return notifyWarning("Añade al menos un producto")
                if (items.some(it => !it.Cantidad || it.Cantidad < 1)) {
                    return notifyWarning("Todas las cantidades deben ser al menos 1")
                }

                const resultado = await orderService.crearPedidoManual({
                    ID_Cliente: idCliente,
                    ID_Usuario: miIdUsuario,
                    ID_TipoAtencion: Number(selTipo.value),
                    N_Comensales: Number(inComensales.value) || 1,
                    Observacion: inObservacion.value.trim(),
                    USUCRE: idUsuarioActual,
                    items,
                })
                if (!resultado.ok) {
                    console.error("Error al crear pedido:", resultado.error)
                    return notifyError(resultado.error?.message || "No se pudo crear el pedido")
                }
                notifySuccess("Pedido creado")
            }
        } finally {
            btnGuardar.disabled = false
        }

        cerrarModal(modal)
        await recargar()
    }

    async function eliminar(id) {
        const pedido = pedidos.find(p => String(p.ID_Pedido) === String(id))
        if (!pedido) return
        const n = (pedido.DETALLE_PEDIDO || []).length
        confirmarBorrado({
            titulo: "Eliminar pedido",
            cuerpo: `<p>Se eliminara el pedido <strong>#${escaparHTML(String(pedido.Numero_Pedido ?? pedido.ID_Pedido))}</strong>${n ? ` y sus ${n} linea${n === 1 ? "" : "s"}` : ""}.</p>
                     <p class="modal-nota modal-nota--peligro">Borrado fisico, no se puede deshacer.</p>`,
            onConfirm: async () => {
                const resultado = await orderService.eliminarPedido(id)
                if (!resultado.ok) {
                    console.error("Error al eliminar pedido:", resultado.error)
                    return notifyError("No se pudo eliminar el pedido")
                }
                notifySuccess("Pedido eliminado")
                await recargar()
            },
        })
    }

    /** Se relee en vez de recargar la pagina: reload() vuelve a pedir la
        sesion, pierde la posicion y parpadea toda la pantalla. */
    async function recargar() {
        const r = await orderService.listarTodos()
        if (r.ok) pedidos = r.data
        else {
            console.error("Error al recargar pedidos:", r.error)
            notifyError("No se pudo actualizar la lista")
        }
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    tbody.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const { accion, id } = btn.dataset
        if (accion === "detalle") verDetalle(id)
        else if (accion === "editar") abrirEdicion(id)
        else if (accion === "eliminar") eliminar(id)
    })

    const btnNuevo = contenedor.querySelector("#pedidos-nuevo")
    if (btnNuevo && puedeCrear) btnNuevo.addEventListener("click", abrirNuevo)

    modal.querySelector("#pedidos-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    modal.querySelector("#pedidos-add-item").addEventListener("click", agregarItem)
    btnGuardar.addEventListener("click", guardar)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })
    modal.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") guardar() })

    const cerrarDetalle = contenedor.querySelector("#pedidos-detalle-cerrar")
    cerrarDetalle.addEventListener("click", () => cerrarModal(detalleModal))
    detalleModal.addEventListener("click", e => { if (e.target === detalleModal) cerrarModal(detalleModal) })

    const cleanup = cerrarConEscape(modal, detalleModal)
    pintarTabla()

    return cleanup
}

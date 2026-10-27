import { supabase } from "../../lib/supabaseClient.js"
import { ventaService } from "../../services/ventaService.js"
import { clientService } from "../../services/clientService.js"
import { productService } from "../../services/productService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio } from "../../utils/format.js"

const ESTADO_VENTA = { P: "Pendiente", C: "Completada", X: "Anulada" }

export async function ventasController(contenedor) {
    const [ventasR, clientesR, productosR, sesion] = await Promise.all([
        ventaService.listarVentas(),
        clientService.listarClientes(),
        productService.listarProductosAdmin(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let ventas = ventasR.ok ? ventasR.data : []
    let clientes = clientesR.ok ? clientesR.data : []
    let productos = productosR.ok ? productosR.data : []
    let aperturas = []
    let metodosPago = []
    let editandoId = null

    const tbodyEl = contenedor.querySelector("#ventas-tbody")
    const modalEl = contenedor.querySelector("#ventas-modal")
    const selCliente = modalEl.querySelector("#ventas-input-cliente")
    const selApertura = modalEl.querySelector("#ventas-input-apertura")
    const selPago = modalEl.querySelector("#ventas-input-pago")
    const listaItems = modalEl.querySelector("#ventas-items")
    const elTotal = modalEl.querySelector("#ventas-total")
    const inPagado = modalEl.querySelector("#ventas-input-pagado")
    const btnGuardar = modalEl.querySelector("#ventas-modal-guardar")
    const btnCancelar = modalEl.querySelector("#ventas-modal-cancelar")
    const btnNuevo = contenedor.querySelector("#ventas-nuevo")
    const titulo = modalEl.querySelector("#ventas-modal-titulo")

    /* Modal de detalle */
    const detModalEl = contenedor.querySelector("#ventas-detalle-modal")
    const detId = detModalEl.querySelector("#det-venta-id")
    const detFecha = detModalEl.querySelector("#det-venta-fecha")
    const detCliente = detModalEl.querySelector("#det-venta-cliente")
    const detTotal = detModalEl.querySelector("#det-venta-total")
    const detItems = detModalEl.querySelector("#det-venta-items")
    const detSubtotal = detModalEl.querySelector("#det-subtotal")
    const detIgv = detModalEl.querySelector("#det-igv")
    const detTotalLabel = detModalEl.querySelector("#det-total")
    const btnDetCerrar = detModalEl.querySelector("#ventas-detalle-cerrar")

    /* ---------- catálogos de caja ---------- */

    async function cargarCaja() {
        const [rAperturas, rPagos] = await Promise.all([
            supabase
                .from("APERTURA_CAJA")
                .select("ID_AperturaCaja, Numero_Turno, CAJA ( N_Caja ), Situacion")
                .eq("Situacion", "A")
                .order("Numero_Turno", { ascending: false }),
            supabase
                .from("METODO_PAGO")
                .select("ID_MetodoPago, N_MetodoPago")
                .eq("ESTADO", "1")
                .order("N_MetodoPago")
        ])
        if (!rAperturas.error) aperturas = rAperturas.data || []
        if (!rPagos.error) metodosPago = rPagos.data || []

        selApertura.replaceChildren(
            ...aperturas.map(a => {
                const o = document.createElement("option")
                o.value = a.ID_AperturaCaja
                const caja = a.CAJA?.[0]?.N_Caja || "Caja"
                o.textContent = `Turno ${a.Numero_Turno} — ${escaparHTML(caja)}`
                return o
            })
        )
        selPago.replaceChildren(
            ...metodosPago.map(m => {
                const o = document.createElement("option")
                o.value = m.ID_MetodoPago
                o.textContent = escaparHTML(m.N_MetodoPago || "Pago")
                return o
            })
        )
    }

    /* ---------- tabla ---------- */

    function nombreClienteDe(venta) {
        const p = venta.CLIENTE?.[0]?.PERSONA?.[0]
        if (!p) return `Cliente #${venta.ID_Cliente ?? "—"}`
        return [p.Nombre, p.Ap_Paterno].filter(Boolean).join(" ").trim() || `Cliente #${venta.ID_Cliente}`
    }

    function pintarTabla() {
        if (!ventas.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="9">No hay ventas. Registra la primera.</td></tr>'
            return
        }

        tbodyEl.innerHTML = ventas.map(v => {
            const cajero = v.USUARIO?.[0]?.Logeo || "—"
            const caja = v.APERTURA_CAJA?.[0]
            const cajaTexto = caja
                ? `Turno ${caja.Numero_Turno} / ${escaparHTML(caja.CAJA?.[0]?.N_Caja || "")}`
                : "—"
            return `
                <tr data-id="${v.ID_Venta}">
                    <td>#${v.ID_Venta}</td>
                    <td>${escaparHTML(v.F_Venta || "-")}</td>
                    <td>${escaparHTML(nombreClienteDe(v))}</td>
                    <td>${escaparHTML(cajero)}</td>
                    <td>${cajaTexto}</td>
                    <td>S/ ${formatearPrecio(v.Total || 0)}</td>
                    <td>${escaparHTML(ESTADO_VENTA[v.Situacion] || v.Situacion || "-")}</td>
                    <td>
                        <button class="btn-icono" type="button" data-accion="ver" data-id="${v.ID_Venta}" title="Ver detalle" aria-label="Ver venta ${v.ID_Venta}">${icono("eye", { size: 16 })}</button>
                    </td>
                    <td>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="anular" data-id="${v.ID_Venta}" title="Anular" aria-label="Anular venta ${v.ID_Venta}">${icono("trash-2", { size: 16 })}</button>
                    </td>
                </tr>
            `
        }).join("")
    }

    /* ---------- lineas de productos ---------- */

    function totalItems() {
        let suma = 0
        for (const fila of listaItems.querySelectorAll(".venta-item")) {
            const sel = fila.querySelector(".item-producto")
            const cant = Number(fila.querySelector(".item-cantidad").value) || 0
            const precio = Number(sel.selectedOptions[0]?.dataset.precio || 0)
            suma += cant * precio
        }
        return suma
    }

    function pintarTotal() {
        const subTotal = totalItems()
        const igv = Number((subTotal * 0.18).toFixed(2))
        const total = Number((subTotal + igv).toFixed(2))
        elTotal.textContent = `S/ ${formatearPrecio(total)}`
        return { subTotal, igv, total }
    }

    function agregarItem() {
        const fila = document.createElement("div")
        fila.className = "venta-item"
        const opciones = ['<option value="">Producto…</option>'].concat(
            [...productos]
                .sort((a, b) => a.N_Producto.localeCompare(b.N_Producto))
                .map(p => `<option value="${p.ID_Producto}" data-precio="${Number(p.Precio)}">${escaparHTML(p.N_Producto)} — S/ ${formatearPrecio(p.Precio)}</option>`)
        ).join("")

        fila.innerHTML = `
            <select class="select item-producto">${opciones}</select>
            <input class="input item-cantidad" type="number" min="1" step="1" value="1" aria-label="Cantidad">
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
        titulo.textContent = "Nueva venta"
        selCliente.value = ""
        const tipoDocBoleta = modalEl.querySelector('input[name="ventas-tipo-doc"][value="Boleta"]')
        if (tipoDocBoleta) tipoDocBoleta.checked = true
        selApertura.value = ""
        selPago.value = ""
        inPagado.value = ""
        listaItems.replaceChildren()
        agregarItem()
        pintarTotal()
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        selCliente.focus()
    }

    function cerrarModal() {
        modalEl.hidden = true
        editandoId = null
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        const idCliente = Number(selCliente.value) || null
        const idApertura = Number(selApertura.value)
        const idPago = Number(selPago.value)
        const tipoDoc = modalEl.querySelector('input[name="ventas-tipo-doc"]:checked').value

        if (!idApertura) return notifyWarning("Selecciona una apertura de caja")
        if (!idPago) return notifyWarning("Selecciona un método de pago")

        const items = [...listaItems.querySelectorAll(".venta-item")]
            .map(fila => {
                const sel = fila.querySelector(".item-producto")
                const cant = Number(fila.querySelector(".item-cantidad").value)
                return {
                    ID_Producto: Number(sel.value),
                    Cantidad: cant,
                    Precio: Number(sel.selectedOptions[0]?.dataset.precio || 0)
                }
            })
            .filter(it => it.ID_Producto)

        if (!items.length) return notifyWarning("Añade al menos un producto")
        if (items.some(it => !it.Cantidad || it.Cantidad < 1)) {
            return notifyWarning("Todas las cantidades deben ser al menos 1")
        }

        const totals = pintarTotal()
        const tPagado = Number(inPagado.value) || totals.total

        const datos = {
            ID_Cliente: idCliente,
            ID_AperturaCaja: idApertura,
            TipoDocumento: tipoDoc,
            ID_MetodoPago: idPago,
            T_Pagado: tPagado,
            USUCRE: usucre,
            productos: items
        }

        btnGuardar.disabled = true
        const resultado = await ventaService.crearVenta(datos)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al crear venta:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo registrar la venta")
        }

        notifySuccess("Venta registrada")
        cerrarModal()
        await recargar()
    }

    async function anularVenta(id) {
        const venta = ventas.find(v => v.ID_Venta === id)
        if (!venta) return

        const confirmacion = new (await import("../../components/Modal.js")).Modal({
            title: "Anular venta",
            body: `<p>Se anulara la venta <strong>#${venta.ID_Venta}</strong> (Total S/ ${formatearPrecio(venta.Total || 0)}).</p>
                   <p class="modal-nota modal-nota--peligro">El anulado no se puede deshacer. El stock devuelto se gestiona aparte.</p>`,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Anular",
                    className: "btn btn--danger",
                    onClick: async (modal, boton) => {
                        boton.disabled = true
                        const motivo = prompt("Motivo de la anulación:")
                        const resultado = await ventaService.anularVenta(id, motivo || null)
                        boton.disabled = false
                        modal.close()
                        if (!resultado.ok) {
                            console.error("Error al anular venta:", resultado.error)
                            return notifyError("No se pudo anular la venta")
                        }
                        notifySuccess("Venta anulada")
                        await recargar()
                    }
                }
            ]
        })
        confirmacion.open()
    }

    async function verDetalle(idVenta) {
        const resultado = await ventaService.obtenerDetalleVenta(idVenta)
        if (!resultado.ok) {
            console.error("Error al obtener detalle:", resultado.error)
            return notifyError("No se pudo cargar el detalle de la venta")
        }
        const items = resultado.data || []

        const venta = ventas.find(v => v.ID_Venta === idVenta)
        if (!venta) return

        const cliente = venta.CLIENTE?.[0]
        const persona = cliente?.PERSONA?.[0]
        const nombreCliente = persona
            ? `${persona.Nombre} ${persona.Ap_Paterno || ""}`.trim()
            : (cliente ? `Cliente #${cliente.ID_Cliente}` : "-")

        const fecha = venta.F_Venta ? new Date(venta.F_Venta).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "-"
        const total = Number(venta.Total || 0)
        const subTotal = Number(venta.Sub_Total || 0)
        const igv = Number(venta.IGV || 0)

        detId.textContent = `#${venta.ID_Venta}`
        detFecha.textContent = fecha
        detCliente.textContent = escaparHTML(nombreCliente)
        detTotal.textContent = `S/ ${total.toFixed(2)}`
        detSubtotal.textContent = `S/ ${subTotal.toFixed(2)}`
        detIgv.textContent = `S/ ${igv.toFixed(2)}`
        detTotalLabel.textContent = `S/ ${total.toFixed(2)}`

        if (!items.length) {
            detItems.innerHTML = '<tr><td colspan="4" class="vacio">Sin productos en el detalle.</td></tr>'
        } else {
            detItems.innerHTML = items.map(it => {
                const nombre = it.PRODUCTO?.[0]?.N_Producto || `Producto ${it.ID_Producto}`
                const cantidad = Number(it.Cantidad || 0)
                const precio = Number(it.Precio || 0)
                const subtotal = Number(it.Sub_Total || cantidad * precio)
                return `
                    <tr>
                        <td>${escaparHTML(nombre)}</td>
                        <td>${cantidad}</td>
                        <td>S/ ${precio.toFixed(2)}</td>
                        <td>S/ ${subtotal.toFixed(2)}</td>
                    </tr>
                `
            }).join("")
        }

        detModalEl.hidden = false
        document.body.classList.add("sin-scroll")
    }

    async function recargar() {
        const r = await ventaService.listarVentas()
        if (r.ok) {
            ventas = r.data
        } else {
            console.error("Error al recargar ventas:", r.error)
            return notifyError("No se pudieron recargar las ventas")
        }
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    await cargarCaja()
    pintarTabla()

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const venta = ventas.find(v => v.ID_Venta === Number(btn.dataset.id))
        if (!venta) return
        if (btn.dataset.accion === "ver") {
            verDetalle(venta.ID_Venta)
        } else if (btn.dataset.accion === "anular") {
            anularVenta(venta.ID_Venta)
        }
    })

    btnNuevo.addEventListener("click", abrirNuevo)
    btnCancelar.addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    modalEl.querySelector("#ventas-add-item").addEventListener("click", agregarItem)
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => {
        if (e.key === "Escape") {
            if (!modalEl.hidden) cerrarModal()
            if (!detModalEl.hidden) {
                detModalEl.hidden = true
                document.body.classList.remove("sin-scroll")
            }
        }
    }
    document.addEventListener("keydown", onEscape)

    btnDetCerrar.addEventListener("click", () => {
        detModalEl.hidden = true
        document.body.classList.remove("sin-scroll")
    })
    detModalEl.addEventListener("click", e => { if (e.target === detModalEl) { detModalEl.hidden = true; document.body.classList.remove("sin-scroll") } })

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

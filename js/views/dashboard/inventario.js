import { inventarioService } from "../../services/inventarioService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio } from "../../utils/format.js"

export async function inventarioController(contenedor) {
    const [sesion] = await Promise.all([
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let productos = []
    let soloBajoStock = false

    const tbodyEl = contenedor.querySelector("#inventario-tbody")
    const filtroBajo = contenedor.querySelector("#inventario-filtro-bajo")

    const modalEl = contenedor.querySelector("#inventario-modal")
    const divProducto = modalEl.querySelector("#inventario-modal-producto")
    const inStock = modalEl.querySelector("#inventario-input-stock")
    const inMotivo = modalEl.querySelector("#inventario-input-motivo")
    const btnGuardar = modalEl.querySelector("#inventario-modal-guardar")
    const btnCancelar = modalEl.querySelector("#inventario-modal-cancelar")

    let productoSeleccionado = null

    /* ---------- carga ---------- */

    async function cargar() {
        const resultado = soloBajoStock
            ? await inventarioService.listarBajoStock()
            : await inventarioService.listarProductos()

        if (!resultado.ok) {
            console.error("Error cargando inventario:", resultado.error)
            return notifyError("No se pudieron cargar los productos")
        }

        productos = resultado.data
        pintarTabla()
    }

    /* ---------- tabla ---------- */

    function estadoDe(stock, minimo) {
        const actual = Number(stock || 0)
        const min = Number(minimo || 0)
        if (actual <= 0) return { texto: "Agotado", clase: "estado-agotado" }
        if (actual <= min) return { texto: "Bajo", clase: "estado-bajo" }
        return { texto: "Normal", clase: "estado-normal" }
    }

    function pintarTabla() {
        if (!productos.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="6">Sin productos con stock controlado.</td></tr>'
            return
        }

        tbodyEl.innerHTML = productos.map(p => {
            const est = estadoDe(p.Stock_Actual, p.Stock_Minimo)
            const categoria = p.CATEGORIA_PRODUCTO?.[0]?.N_CategoriaProducto || "-"
            return `
                <tr data-id="${p.ID_Producto}">
                    <td>${escaparHTML(p.N_Producto || "-")}</td>
                    <td>${escaparHTML(categoria)}</td>
                    <td>${Number(p.Stock_Actual || 0)}</td>
                    <td>${Number(p.Stock_Minimo || 0)}</td>
                    <td><span class="chip chip--estado-${est.clase}">${est.texto}</span></td>
                    <td>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="ajustar" data-id="${p.ID_Producto}" title="Ajustar stock" aria-label="Ajustar stock de ${escaparHTML(p.N_Producto || "")}">${icono("alert-circle", { size: 16 })}</button>
                    </td>
                </tr>
            `
        }).join("")
    }

    /* ---------- modal ---------- */

    function abrirAjustar(producto) {
        productoSeleccionado = producto
        divProducto.textContent = `${escaparHTML(producto.N_Producto || "")} — Stock actual: ${Number(producto.Stock_Actual || 0)} (mínimo: ${Number(producto.Stock_Minimo || 0)})`
        inStock.value = producto.Stock_Actual || 0
        inMotivo.value = ""
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        inStock.focus()
    }

    function cerrarModal() {
        modalEl.hidden = true
        productoSeleccionado = null
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        const nuevoStock = Number(inStock.value)
        const motivo = inMotivo.value.trim() || null

        if (!productoSeleccionado) return
        if (!nuevoStock && nuevoStock !== 0) return notifyWarning("Ingresa un stock válido")
        if (nuevoStock < 0) return notifyWarning("El stock no puede ser negativo")

        btnGuardar.disabled = true
        const resultado = await inventarioService.ajustarStock(productoSeleccionado.ID_Producto, nuevoStock, motivo)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al ajustar stock:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo ajustar el stock")
        }

        notifySuccess("Stock ajustado")
        cerrarModal()
        await cargar()
    }

    /* ---------- eventos ---------- */

    filtroBajo.addEventListener("change", () => {
        soloBajoStock = filtroBajo.checked
        cargar()
    })

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const producto = productos.find(p => p.ID_Producto === Number(btn.dataset.id))
        if (!producto) return
        if (btn.dataset.accion === "ajustar") abrirAjustar(producto)
    })

    btnCancelar.addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => { if (e.key === "Escape" && !modalEl.hidden) cerrarModal() }
    document.addEventListener("keydown", onEscape)

    await cargar()

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

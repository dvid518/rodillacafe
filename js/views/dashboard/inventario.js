import { inventarioService } from "../../services/inventarioService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio } from "../../utils/format.js"
import { unwrapEmbed } from "../../utils/supabaseHelpers.js"

export async function inventarioController(contenedor) {
    const [sesion] = await Promise.all([
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let productos = []
    let soloBajoStock = false
    let categoriaSeleccionada = null

    const tbodyEl = contenedor.querySelector("#inventario-tbody")
    const filtroBajo = contenedor.querySelector("#inventario-filtro-bajo")
    const contenedorCategorias = contenedor.querySelector(".categorias-filtro")

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
        renderizarContadoresCategorias()
        pintarTabla()
    }

    function renderizarContadoresCategorias() {
        if (!contenedorCategorias) return

        const categorias = ["ADMINISTRADOR", "CAJERO", "MOZO", "CLIENTE"].map(rol => ({
            id: rol.toLowerCase(),
            nombre: rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase()
        }))

        // Contar productos por categoría
        const conteos = {}
        productos.forEach(p => {
            const cat = unwrapEmbed(p.CATEGORIA_PRODUCTO)?.N_CategoriaProducto || "Sin categoría"
            conteos[cat] = (conteos[cat] || 0) + 1
        })

        const html = categorias.map(cat => {
            const count = conteos[cat.nombre] || 0
            const estaSeleccionada = categoriaSeleccionada === cat.id
            return `
                <button class="categoria-filtro ${estaSeleccionada ? 'activo' : ''}" data-categoria="${cat.id}">
                    ${cat.nombre} (${count})
                </button>
            `
        }).join("")

        contenedorCategorias.innerHTML = html

        // Agregar eventos a los botones
        contenedorCategorias.querySelectorAll(".categoria-filtro").forEach(btn => {
            btn.addEventListener("click", () => {
                const categoriaId = btn.dataset.categoria
                if (categoriaSeleccionada === categoriaId) {
                    categoriaSeleccionada = null
                    btn.classList.remove("activo")
                } else {
                    categoriaSeleccionada = categoriaId
                    contenedorCategorias.querySelectorAll(".categoria-filtro").forEach(b => b.classList.remove("activo"))
                    btn.classList.add("activo")
                }
                pintarTabla()
            })
        })
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
        const productosFiltrados = categoriaSeleccionada
            ? productos.filter(p => {
                  const cat = unwrapEmbed(p.CATEGORIA_PRODUCTO)?.N_CategoriaProducto || "Sin categoría"
                  return cat === categoriaSeleccionada
              })
            : productos

        if (!productosFiltrados.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="6">No se encontraron productos con estos filtros.</td></tr>'
            return
        }

        tbodyEl.innerHTML = productosFiltrados.map(p => {
            const est = estadoDe(p.Stock_Actual, p.Stock_Minimo)
            const cat = unwrapEmbed(p.CATEGORIA_PRODUCTO)
            const categoria = cat?.N_CategoriaProducto || "Sin categoría"
            const imagen = p.Imagen ? `<img src="${escaparHTML(p.Imagen)}" alt="${escaparHTML(p.N_Producto)}" style="width:40px;height:40px;object-fit:cover;border-radius:var(--radius-sm);">` : '<div class="placeholder-img"><re-icon icon="package" weight="filled" size="24" decorative style="color:var(--text-muted);"></re-icon></div>'
            return `
                <tr data-id="${p.ID_Producto}">
                    <td>${imagen} ${escaparHTML(p.N_Producto || "-")}</td>
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

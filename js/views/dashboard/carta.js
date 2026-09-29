import { productService } from "../../services/productService.js"
import { categoryService } from "../../services/categoryService.js"
import { authService } from "../../services/authService.js"
import { Modal } from "../../components/Modal.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { formatearPrecio, escaparHTML } from "../../utils/format.js"

/**
 * La barra de secciones fija (bebidas/postres/aperitivos) deja fuera de la
 * carta cualquier categoria nueva creada desde el CRUD de Categorias: el
 * producto se guardaria bien pero no aparecia en ninguna pestana. Por eso las
 * pestanas se arman con las categorias reales y SECCION solo colorea la fila.
 */
const SECCION_POR_AREA = {
    BARRA: "Barra",
    COCINA: "Cocina",
    VITRINA: "Vitrina"
}

const COLOR_POR_AREA = {
    BARRA: "bebidas",
    COCINA: "postres",
    VITRINA: "aperitivos"
}

export async function cartaController(contenedor) {
    const [productos, categorias, unidades, sesion] = await Promise.all([
        productService.listarProductosAdmin(),
        categoryService.listarCategorias(),
        productService.listarUnidades(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    const categoriasPorId = new Map(categorias.ok ? categorias.data.map(c => [c.ID_CategoriaProducto, c]) : [])
    const unidadesPorId = new Map(unidades.ok ? unidades.data.map(u => [u.ID_UnidadMedida, u]) : [])

    let productosActuales = productos.ok ? productos.data : []
    let categoriaActiva = "todas"
    let editando = null

    const tabsEl = contenedor.querySelector("#carta-tabs")
    const tbodyEl = contenedor.querySelector("#carta-tbody")
    const modalEl = contenedor.querySelector("#carta-modal")

    const inputNombre = modalEl.querySelector("#carta-input-nombre")
    const inputPrecio = modalEl.querySelector("#carta-input-precio")
    const inputImagen = modalEl.querySelector("#carta-input-imagen")
    const selectCategoria = modalEl.querySelector("#carta-input-categoria")
    const selectUnidad = modalEl.querySelector("#carta-input-unidad")
    const tituloModal = modalEl.querySelector("#carta-modal-titulo")
    const btnEliminar = modalEl.querySelector("#carta-modal-eliminar")
    const btnGuardar = modalEl.querySelector("#carta-modal-guardar")

    function pintarTabs() {
        const cats = categorias.ok ? categorias.data : []
        tabsEl.replaceChildren()
        const opciones = [{ id: "todas", nombre: "Todas" }, ...cats]
        for (const cat of opciones) {
            const btn = document.createElement("button")
            btn.type = "button"
            btn.className = "tab" + (String(cat.id) === String(categoriaActiva) ? " tab--activo" : "")
            btn.dataset.tab = String(cat.id)
            btn.setAttribute("role", "tab")
            btn.setAttribute("aria-selected", String(String(cat.id) === String(categoriaActiva)))
            const n = cat.id === "todas"
                ? productosActuales.length
                : productosActuales.filter(p => p.ID_CategoriaProducto === cat.id).length
            btn.textContent = `${cat.nombre} (${n})`
            tabsEl.appendChild(btn)
        }
    }

    function areaDe(categoriaId) {
        return SECCION_POR_AREA[categoriasPorId.get(categoriaId)?.Area_Preparacion] || "Barra"
    }

    function pintarTabla() {
        const visibles = categoriaActiva === "todas"
            ? productosActuales
            : productosActuales.filter(p => p.ID_CategoriaProducto === Number(categoriaActiva))

        if (!visibles.length) {
            tbodyEl.innerHTML = '<tr><td colspan="7" class="vacio">Sin productos en esta categoria</td></tr>'
            return
        }

        tbodyEl.innerHTML = visibles.map(p => {
            const cat = categoriasPorId.get(p.ID_CategoriaProducto)
            const unidad = unidadesPorId.get(p.ID_UnidadMedida)
            const area = areaDe(p.ID_CategoriaProducto)
            const imagen = p.Imagen
                ? `<img src="${escaparHTML(p.Imagen)}" alt="" class="carta-miniatura" loading="lazy">`
                : '<span class="carta-miniatura carta-miniatura--vacia" aria-hidden="true"></span>'
            return `
                <tr data-id="${p.ID_Producto}" class="carta-fila carta-fila--${escaparHTML(COLOR_POR_AREA[cat?.Area_Preparacion] || "bebidas")}">
                    <td>${imagen}</td>
                    <td>${p.ID_Producto}</td>
                    <td>
                        <strong>${escaparHTML(p.N_Producto)}</strong>
                        ${p.Detalle ? `<small class="carta-detalle">${escaparHTML(p.Detalle)}</small>` : ""}
                    </td>
                    <td>${escaparHTML(formatearPrecio(p.Precio))}</td>
                    <td>${escaparHTML(unidad?.Abreviatura || unidad?.N_UnidadMedida || "-")}</td>
                    <td>
                        <button class="btn-icono" type="button" data-accion="editar" data-id="${p.ID_Producto}" title="Editar" aria-label="Editar ${escaparHTML(p.N_Producto)}">${icono("pencil", { size: 16 })}</button>
                    </td>
                    <td>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar" data-id="${p.ID_Producto}" title="Eliminar" aria-label="Eliminar ${escaparHTML(p.N_Producto)}">${icono("trash-2", { size: 16 })}</button>
                    </td>
                </tr>
            `
        }).join("")
    }

    /* ---------- modal de formulario ---------- */

    function abrirModal(producto = null) {
        editando = producto
        tituloModal.textContent = producto ? `Editar: ${producto.N_Producto}` : "Nuevo producto"
        inputNombre.value = producto?.N_Producto || ""
        inputPrecio.value = producto?.Precio ?? ""
        inputImagen.value = producto?.Imagen || ""
        selectCategoria.value = producto?.ID_CategoriaProducto ?? ""
        selectUnidad.value = producto?.ID_UnidadMedida ?? ""
        btnEliminar.hidden = !producto
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        inputNombre.focus()
    }

    function cerrarModal() {
        modalEl.hidden = true
        editando = null
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        const nombre = inputNombre.value.trim()
        const precio = Number(inputPrecio.value)
        const idCategoria = Number(selectCategoria.value)
        const idUnidad = Number(selectUnidad.value)

        if (!idCategoria) return notifyWarning("Selecciona una categoria")
        if (!idUnidad) return notifyWarning("Selecciona una unidad de medida")
        if (!nombre) return notifyWarning("Ingresa un nombre")
        if (!precio || !Number.isFinite(precio) || precio <= 0) return notifyWarning("Ingresa un precio valido")

        const datos = {
            N_Producto: nombre,
            Precio: precio,
            Imagen: inputImagen.value.trim() || null,
            ID_CategoriaProducto: idCategoria,
            ID_UnidadMedida: idUnidad
        }

        btnGuardar.disabled = true
        const resultado = editando
            ? await productService.actualizarProducto(editando.ID_Producto, datos)
            : await productService.crearProducto({ ...datos, USUCRE: usucre })
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error(editando ? "Error al actualizar producto:" : "Error al crear producto:", resultado.error)
            return notifyError(
                `Error al ${editando ? "actualizar" : "crear"} producto: ${resultado.error?.message || "desconocido"}`
            )
        }

        notifySuccess(editando ? "Producto actualizado" : "Producto creado")
        cerrarModal()
        await recargar()
    }

    async function eliminarProducto(producto) {
        const confirmacion = new Modal({
            title: "Eliminar producto",
            body: `<p>Se eliminara <strong>${escaparHTML(producto.N_Producto)}</strong> de la carta.</p>
                   <p class="modal-nota">Es un borrado fisico: no se puede deshacer.</p>`,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Eliminar",
                    className: "btn btn--danger",
                    onClick: async (modal, boton) => {
                        boton.disabled = true
                        const resultado = await productService.eliminarProducto(producto.ID_Producto)
                        boton.disabled = false
                        modal.close()
                        if (!resultado.ok) {
                            console.error("Error al eliminar producto:", resultado.error)
                            return notifyError("No se pudo eliminar el producto")
                        }
                        notifySuccess("Producto eliminado")
                        await recargar()
                    }
                }
            ]
        })
        confirmacion.open()
    }

    async function recargar() {
        const nuevos = await productService.listarProductosAdmin()
        if (nuevos.ok) {
            productosActuales = nuevos.data
        } else {
            console.error("Error al recargar productos:", nuevos.error)
            return notifyError("No se pudo recargar la carta")
        }
        pintarTabs()
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    function poblarSelects() {
        selectCategoria.replaceChildren()
        const placeholder = document.createElement("option")
        placeholder.value = ""
        placeholder.textContent = "Seleccionar"
        placeholder.disabled = true
        selectCategoria.appendChild(placeholder)
        for (const c of (categorias.ok ? categorias.data : [])) {
            const opt = document.createElement("option")
            opt.value = c.ID_CategoriaProducto
            opt.textContent = c.N_CategoriaProducto
            selectCategoria.appendChild(opt)
        }

        selectUnidad.replaceChildren()
        for (const u of (unidades.ok ? unidades.data : [])) {
            const opt = document.createElement("option")
            opt.value = u.ID_UnidadMedida
            opt.textContent = u.Abreviatura ? `${u.N_UnidadMedida} (${u.Abreviatura})` : u.N_UnidadMedida
            selectUnidad.appendChild(opt)
        }
    }

    tabsEl.addEventListener("click", e => {
        const tab = e.target.closest("[data-tab]")
        if (!tab) return
        categoriaActiva = tab.dataset.tab
        pintarTabs()
        pintarTabla()
    })

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const producto = productosActuales.find(p => p.ID_Producto === Number(btn.dataset.id))
        if (!producto) return
        if (btn.dataset.accion === "editar") abrirModal(producto)
        else eliminarProducto(producto)
    })

    contenedor.querySelector("#carta-nuevo").addEventListener("click", () => abrirModal(null))
    modalEl.querySelector("#carta-modal-cancelar").addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    btnEliminar.addEventListener("click", () => { if (editando) eliminarProducto(editando) })
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => { if (e.key === "Escape" && !modalEl.hidden) cerrarModal() }
    document.addEventListener("keydown", onEscape)

    if (!categorias.ok || categorias.data.length === 0) {
        notifyWarning("No hay categorias: crea una antes de agregar productos")
    }

    poblarSelects()
    pintarTabs()
    pintarTabla()

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

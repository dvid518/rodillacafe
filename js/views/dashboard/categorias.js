import { categoryService } from "../../services/categoryService.js"
import { productService } from "../../services/productService.js"
import { authService } from "../../services/authService.js"
import { Modal } from "../../components/Modal.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"

export async function categoriasController(contenedor) {
    const [categorias, productos, sesion] = await Promise.all([
        categoryService.listarCategorias(),
        productService.listarProductosAdmin(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let categoriasActuales = categorias.ok ? categorias.data : []
    let productosActuales = productos.ok ? productos.data : []
    let editando = null

    const tbodyEl = contenedor.querySelector("#cat-tbody")
    const modalEl = contenedor.querySelector("#cat-modal")
    const inputNombre = modalEl.querySelector("#cat-input-nombre")
    const inputDescripcion = modalEl.querySelector("#cat-input-descripcion")
    const selectArea = modalEl.querySelector("#cat-input-area")
    const tituloModal = modalEl.querySelector("#cat-modal-titulo")
    const btnEliminar = modalEl.querySelector("#cat-modal-eliminar")
    const btnGuardar = modalEl.querySelector("#cat-modal-guardar")

    function productosDe(categoriaId) {
        return productosActuales.filter(p => p.ID_CategoriaProducto === categoriaId)
    }

    function pintarTabla() {
        if (!categoriasActuales.length) {
            tbodyEl.innerHTML = '<tr><td colspan="6" class="vacio">No hay categorias. Crea la primera.</td></tr>'
            return
        }

        tbodyEl.innerHTML = categoriasActuales.map(c => {
            const n = productosDe(c.ID_CategoriaProducto).length
            return `
                <tr data-id="${c.ID_CategoriaProducto}">
                    <td>${c.ID_CategoriaProducto}</td>
                    <td><strong>${escaparHTML(c.N_CategoriaProducto)}</strong></td>
                    <td>${escaparHTML(c.Descripcion || "-")}</td>
                    <td><span class="chip chip--${escaparHTML((c.Area_Preparacion || "barra").toLowerCase())}">${escaparHTML(c.Area_Preparacion || "-")}</span></td>
                    <td>
                        <button class="btn-icono" type="button" data-accion="editar" data-id="${c.ID_CategoriaProducto}" title="Editar" aria-label="Editar ${escaparHTML(c.N_CategoriaProducto)}">${icono("pencil", { size: 16 })}</button>
                    </td>
                    <td>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar" data-id="${c.ID_CategoriaProducto}" title="Eliminar" aria-label="Eliminar ${escaparHTML(c.N_CategoriaProducto)}">${icono("trash-2", { size: 16 })}</button>
                    </td>
                </tr>
                ${n ? `<tr class="cat-subfila"><td colspan="6">${n} producto${n === 1 ? "" : "s"} en la carta</td></tr>` : ""}
            `
        }).join("")
    }

    /* ---------- modal de formulario ---------- */

    function abrirModal(categoria = null) {
        editando = categoria
        tituloModal.textContent = categoria ? `Editar: ${categoria.N_CategoriaProducto}` : "Nueva categoria"
        inputNombre.value = categoria?.N_CategoriaProducto || ""
        inputDescripcion.value = categoria?.Descripcion || ""
        selectArea.value = categoria?.Area_Preparacion || "BARRA"
        btnEliminar.hidden = !categoria
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
        if (!nombre) return notifyWarning("El nombre es obligatorio")

        const datos = {
            N_CategoriaProducto: nombre,
            Descripcion: inputDescripcion.value.trim() || null,
            Area_Preparacion: selectArea.value
        }

        btnGuardar.disabled = true
        const resultado = editando
            ? await categoryService.actualizarCategoria(editando.ID_CategoriaProducto, datos)
            : await categoryService.crearCategoria({ ...datos, ESTADO: "1", USUCRE: usucre })
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al guardar categoria:", resultado.error)
            return notifyError("No se pudo guardar la categoria")
        }

        notifySuccess(editando ? "Categoria actualizada" : "Categoria creada")
        cerrarModal()
        await recargar()
    }

    /**
     * CATEGORIA_PRODUCTO se borra en fisico y PRODUCTO la referencia con
     * FK_PRODUCTO_CATEGORIA. Si la categoria tiene productos, el DELETE
     * revienta con 23503, asi que se avisa antes de preguntar.
     */
    async function eliminarCategoria(categoria) {
        const afectados = productosDe(categoria.ID_CategoriaProducto)
        const nombres = afectados.slice(0, 4).map(p => p.N_Producto).join(", ")
        const mas = afectados.length > 4 ? ` y ${afectados.length - 4} mas` : ""

        const confirmacion = new Modal({
            title: "Eliminar categoria",
            body: `
                ${afectados.length
                    ? `<p><strong>${escaparHTML(categoria.N_CategoriaProducto)}</strong> tiene ${afectados.length} producto${afectados.length === 1 ? "" : "s"}: ${escaparHTML(nombres)}${escaparHTML(mas)}.</p>
                       <p class="modal-nota modal-nota--peligro">Borrarla dejara esos productos sin categoria y el servidor rechazara la operacion. Reasignalos primero.</p>`
                    : `<p>Se eliminara <strong>${escaparHTML(categoria.N_CategoriaProducto)}</strong>.</p>
                       <p class="modal-nota">Es un borrado fisico: no se puede deshacer.</p>`}
            `,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Eliminar",
                    className: "btn btn--danger",
                    onClick: async (modal, boton) => {
                        boton.disabled = true
                        const resultado = await categoryService.eliminarCategoria(categoria.ID_CategoriaProducto)
                        boton.disabled = false
                        modal.close()
                        if (!resultado.ok) {
                            console.error("Error al eliminar categoria:", resultado.error)
                            return notifyError("No se pudo eliminar: la categoria tiene productos asociados")
                        }
                        notifySuccess("Categoria eliminada")
                        await recargar()
                    }
                }
            ]
        })
        confirmacion.open()
    }

    async function recargar() {
        const nuevos = await categoryService.listarCategorias()
        if (nuevos.ok) {
            categoriasActuales = nuevos.data
        } else {
            console.error("Error al recargar categorias:", nuevos.error)
            return notifyError("No se pudieron recargar las categorias")
        }
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const categoria = categoriasActuales.find(c => c.ID_CategoriaProducto === Number(btn.dataset.id))
        if (!categoria) return
        if (btn.dataset.accion === "editar") abrirModal(categoria)
        else eliminarCategoria(categoria)
    })

    contenedor.querySelector("#cat-nuevo").addEventListener("click", () => abrirModal(null))
    modalEl.querySelector("#cat-modal-cancelar").addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    btnEliminar.addEventListener("click", () => { if (editando) eliminarCategoria(editando) })
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => { if (e.key === "Escape" && !modalEl.hidden) cerrarModal() }
    document.addEventListener("keydown", onEscape)

    pintarTabla()

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

import { guardRol } from "../../session/roleGuard.js"
import { orderService } from "../../services/orderService.js"
import { userService } from "../../services/userService.js"
import { productService } from "../../services/productService.js"
import { clientService } from "../../services/clientService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { formatearFecha, formatearPrecio, escaparHTML } from "../../utils/format.js"
import { unwrapEmbed } from "../../utils/supabaseHelpers.js"
import {
    ESTADO_PEDIDO, badge, filaVacia, filaError, opcionesEstado, monto,
    abrirModal, cerrarModal, cerrarConEscape, poblarClientes,
    mapaUsuarios, confirmarBorrado,
} from "./crud-comun.js"

/* La fila lleva la columna del ID_Pedido: es lo que la identifica de forma
   univoca (el Numero_Pedido alfanumerico se sigue generando y guardando,
   PEDIDO.Numero_Pedido es NOT NULL, pero no se muestra). Las acciones viajan
   por data-id, que es el ID_Pedido. */
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
    const inBuscarCliente = modal.querySelector("#pedidos-buscar-cliente")
    const btnNuevoCliente = modal.querySelector("#pedidos-nuevo-cliente")
    const inBuscarProducto = modal.querySelector("#pedidos-buscar-producto")
    const selTipo = modal.querySelector("#pedidos-input-tipo")
    const selEstado = modal.querySelector("#pedidos-input-estado")
    const campoEstado = modal.querySelector("#pedidos-campo-estado")
    const inComensales = modal.querySelector("#pedidos-input-comensales")
    const inObservacion = modal.querySelector("#pedidos-input-observacion")
    let panelProductos = modal.querySelector("#pedidos-productos")
    const panelVacio = modal.querySelector("#pedidos-productos-vacio")
    const elTotal = modal.querySelector("#pedidos-total")
    const btnGuardar = modal.querySelector("#pedidos-modal-guardar")
    const fieldsetItems = modal.querySelector("#pedidos-items-fieldset")

    let pedidos = []
    let productos = []
    let clientes = []
    let tipos = []
    let usuariosPorId = new Map()
    let editandoId = null
    let idUsuarioActual = null
    /* Ítems seleccionados: mapa ID_Producto -> { ID_Producto, Cantidad, Precio, nombre } */
    const items = new Map()

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
    /* Se puede abrir el alta aunque la lista de clientes esté vacía: dentro
       del modal hay un botón "Nuevo cliente" para crear el primero. */
    const puedeCrear = esAdmin && tipos.length > 0

    if (!esAdmin) {
        contenedor.querySelectorAll(".js-solo-admin").forEach(el => el.remove())
    }
    if (esAdmin && clientes.length === 0) {
        aviso.hidden = false
        aviso.textContent = "No hay clientes visibles para tu cuenta: usa «Nuevo cliente» dentro del alta de pedido."
    }

    poblarClientes(selCliente, clientes)
    if (inBuscarCliente) {
        inBuscarCliente.addEventListener("input", () => {
            const q = inBuscarCliente.value.toLowerCase()
            // Se leen las opciones en vivo: tras crear un cliente la lista
            // cambia y una copia antigua dejaría fuera al nuevo.
            for (const opt of selCliente.options) {
                if (opt.value === "") {
                    opt.hidden = false
                    continue
                }
                opt.hidden = !opt.textContent.toLowerCase().includes(q)
            }
        })
    }
    selTipo.replaceChildren(...tipos.map(t => {
        const o = document.createElement("option")
        o.value = t.ID_TipoAtencion
        o.textContent = t.N_TipoAtencion
        return o
    }))
    if (selEstado) selEstado.innerHTML = opcionesEstado(ESTADO_PEDIDO)

    /* ---------- productos disponibles (catálogo) ---------- */

    function productoImagenHtml(p) {
        const imagen = p?.Imagen
        const nombre = escaparHTML(p?.N_Producto || "Producto")
        if (imagen) {
            return `<img src="${escaparHTML(imagen)}" alt="${nombre}" loading="lazy">`
        }
        return `<re-icon icon="package" weight="filled" size="34" decorative style="color:var(--text-muted);"></re-icon>`
    }

    /* Si el navegador conserva un HTML viejo sin #pedidos-productos, el
       controlador no debe romperse: se crea el contenedor sobre la marcha. */
    function obtenerPanelProductos() {
        if (panelProductos) return panelProductos
        const contenido = modal.querySelector(".modal-form__contenido") || modal
        panelProductos = document.createElement("div")
        panelProductos.id = "pedidos-productos"
        panelProductos.className = "venta-panel__productos"
        contenido.appendChild(panelProductos)
        return panelProductos
    }

    function pintarProductos() {
        const q = (inBuscarProducto?.value || "").toLowerCase()
        const filtrados = productos.filter(p =>
            String(p.N_Producto || "").toLowerCase().includes(q)
        )

        if (panelVacio) panelVacio.hidden = filtrados.length > 0
        obtenerPanelProductos().replaceChildren(
            ...filtrados.map(p => {
                const item = items.get(p.ID_Producto)
                const cantidad = item ? item.Cantidad : 0
                const seleccionado = cantidad > 0
                const stock = p.Stock_Actual != null ? Number(p.Stock_Actual) : null
                const sinStock = stock != null && stock <= 0
                const precio = Number(p.Precio || 0)
                const subtotal = cantidad * precio

                const card = document.createElement("article")
                card.className = `venta-producto-card${seleccionado ? " seleccionado" : ""}${sinStock ? " sin-stock" : ""}`
                card.dataset.id = p.ID_Producto

                card.innerHTML = `
                    <div class="venta-producto-card__imagen">${productoImagenHtml(p)}</div>
                    <div class="venta-producto-card__nombre">${escaparHTML(p.N_Producto || "Producto")}</div>
                    <div class="venta-producto-card__acciones">
                        <button class="btn-producto-cant" type="button" data-accion="restar" data-id="${p.ID_Producto}" ${sinStock || cantidad === 0 ? "disabled" : ""}>−</button>
                        <input class="venta-producto-card__cantidad-input" type="number" min="0" value="${cantidad}" data-id="${p.ID_Producto}" ${sinStock ? "disabled" : ""}>
                        <button class="btn-producto-cant btn-producto-cant--agregar" type="button" data-accion="agregar" data-id="${p.ID_Producto}" ${sinStock ? "disabled" : ""}>+</button>
                    </div>
                    <div class="venta-producto-card__meta">
                        <span class="venta-producto-card__precio">S/ ${formatearPrecio(precio)}</span>
                    </div>
                    <div class="venta-producto-card__subtotal">${cantidad > 0 ? "S/ " + formatearPrecio(subtotal) : ""}</div>
                `

                return card
            })
        )
        pintarTotal()
    }

    function cambiarCantidad(idProducto, delta) {
        const p = productos.find(x => x.ID_Producto === idProducto)
        if (!p) return
        const stock = p.Stock_Actual != null ? Number(p.Stock_Actual) : null
        const item = items.get(idProducto)
        const actual = item ? item.Cantidad : 0
        let nueva = actual + delta

        if (nueva < 0) nueva = 0
        if (stock != null && nueva > stock) {
            notifyWarning(`Stock disponible: ${stock}`)
            nueva = stock
        }

        if (nueva === 0) {
            items.delete(idProducto)
        } else {
            items.set(idProducto, {
                ID_Producto: Number(p.ID_Producto),
                Cantidad: nueva,
                Precio: Number(p.Precio || 0),
                nombre: p.N_Producto,
                Imagen: p.Imagen
            })
        }

        pintarProductos()
    }

    /* ---------- tabla ---------- */

    /* Un pedido tiene dos dueños distintos: ID_Cliente es PARA QUIÉN es (el
       consumidor que se factura) e ID_Usuario es QUIÉN LO REGISTRÓ (el propio
       cliente desde la web, o el mozo/cajero en el alta manual). La columna
       "Cliente" muestra el CLIENTE; quién lo tomó se ve en el detalle. */
    function nombreClienteDe(pedido) {
        const cliente = unwrapEmbed(pedido.CLIENTE)
        const persona = unwrapEmbed(cliente?.PERSONA)
        const nombre = [persona?.Nombre, persona?.Ap_Paterno].filter(Boolean).join(" ").trim()
        if (nombre) return nombre
        const empresa = unwrapEmbed(cliente?.EMPRESA)
        if (empresa?.Razon_Social) return empresa.Razon_Social
        // RLS: cajero/mozo pueden no ver CLIENTE; el id es un dato real
        return pedido.ID_Cliente ? `Cliente #${pedido.ID_Cliente}` : "—"
    }

    function registradoPor(pedido) {
        return usuariosPorId.get(pedido.ID_Usuario) || `Usuario #${pedido.ID_Usuario ?? "?"}`
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
            <tr data-id="${p.ID_Pedido}">
                <td>#${p.ID_Pedido}</td>
                <td>${escaparHTML(nombreClienteDe(p))}</td>
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(monto(p.Total))}</td>
                <td>${badge(ESTADO_PEDIDO, p.Situacion)}</td>
                <td>${iconoBoton("eye", "detalle", p.ID_Pedido, "Ver detalle del pedido")}</td>
                <td>${iconoBoton("pencil", "editar", p.ID_Pedido, "Editar pedido")}</td>
                <td>${esAdmin ? iconoBoton("trash-2", "eliminar", p.ID_Pedido, "Eliminar pedido", "btn-icono--peligro") : ""}</td>
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
                <div><dt>ID</dt><dd>#${pedido.ID_Pedido}</dd></div>
                <div><dt>Cliente</dt><dd>${escaparHTML(nombreClienteDe(pedido))}</dd></div>
                <div><dt>Fecha</dt><dd>${escaparHTML(formatearFecha(pedido.F_Pedido, { dateStyle: "medium", timeStyle: "short" }))}</dd></div>
                <div><dt>Comensales</dt><dd>${pedido.N_Comensales ?? "—"}</dd></div>
                <div><dt>Estado</dt><dd>${badge(ESTADO_PEDIDO, pedido.Situacion)}</dd></div>
                <div><dt>Registró</dt><dd>${escaparHTML(registradoPor(pedido))}</dd></div>
            </dl>
            ${pedido.Observacion ? `<p class="detalle__obs"><strong>Observación:</strong> ${escaparHTML(pedido.Observacion)}</p>` : ""}
            <h3 class="detalle__titulo">Productos</h3>
            ${lineas.length ? lineas.map(d => `
                <div class="producto-item">
                    <span>${escaparHTML(unwrapEmbed(d.PRODUCTO)?.N_Producto || `Producto ${d.ID_Producto}`)}</span>
                    <span>${d.Cantidad} × ${escaparHTML(monto(d.Precio))}</span>
                    <strong>${escaparHTML(monto(Number(d.Cantidad) * Number(d.Precio)))}</strong>
                </div>
            `).join("") : '<p class="vacio">Este pedido no tiene productos</p>'}
        `
        abrirModal(detalleModal)
    }

    function pintarTotal() {
        let subTotal = 0
        for (const it of items.values()) {
            subTotal += it.Cantidad * it.Precio
        }
        if (elTotal) elTotal.textContent = monto(subTotal)
    }

    /* ---------- alta rápida de cliente ---------- */

    async function crearClienteRapido() {
        const Modal = (await import("../../components/Modal.js")).Modal

        const formHtml = `
            <div style="display:flex; flex-direction:column; gap: var(--space-sm);">
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Nombre *</label>
                    <input class="input" type="text" id="npcli-nombre" placeholder="Nombres" required>
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Apellido paterno *</label>
                    <input class="input" type="text" id="npcli-apellido" placeholder="Apellido paterno" required>
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">N° Documento (DNI)</label>
                    <input class="input" type="text" id="npcli-dni" placeholder="Ej. 12345678" maxlength="8">
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Celular</label>
                    <input class="input" type="text" id="npcli-celular" placeholder="Ej. 999 888 777">
                </div>
                <p class="modal-nota" style="font-size:0.85rem; color:var(--text-muted); margin-top:var(--space-xs);">
                    Los campos marcados con * son obligatorios.
                </p>
            </div>
        `

        const modalCliente = new Modal({
            title: "Nuevo cliente",
            body: formHtml,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Crear cliente",
                    className: "btn btn--primary",
                    onClick: async (m, boton) => {
                        boton.disabled = true
                        const nombre = document.getElementById("npcli-nombre")?.value?.trim() || ""
                        const apellido = document.getElementById("npcli-apellido")?.value?.trim() || ""
                        const dni = document.getElementById("npcli-dni")?.value?.trim() || null
                        const celular = document.getElementById("npcli-celular")?.value?.trim() || null

                        if (!nombre) {
                            boton.disabled = false
                            return notifyWarning("Ingresa el nombre")
                        }
                        if (!apellido) {
                            boton.disabled = false
                            return notifyWarning("Ingresa el apellido paterno")
                        }

                        const resultado = await clientService.crearClienteNatural({
                            nombre,
                            apPaterno: apellido,
                            nDocumento: dni,
                            celular,
                            usucre: idUsuarioActual || "WEB"
                        })

                        boton.disabled = false

                        if (!resultado.ok) {
                            console.error("Error al crear cliente:", resultado.error)
                            return notifyError(resultado.error?.message || "No se pudo crear el cliente")
                        }

                        const nuevoCliente = resultado.data
                        notifySuccess("Cliente creado")

                        // Recargar la lista y dejar seleccionado el cliente nuevo
                        const r = await userService.listarClientes()
                        if (r.ok) {
                            clientes = r.data
                            poblarClientes(selCliente, clientes)
                            if (inBuscarCliente) inBuscarCliente.value = ""
                            for (const opt of selCliente.options) opt.hidden = false
                            const nuevoOpt = [...selCliente.options].find(
                                o => Number(o.value) === Number(nuevoCliente.ID_Cliente)
                            )
                            if (nuevoOpt) selCliente.value = nuevoOpt.value
                            if (aviso) aviso.hidden = true
                        } else {
                            console.error("Error al recargar clientes:", r.error)
                        }

                        m.close()
                    }
                }
            ]
        })
        modalCliente.open()
    }

    /* ---------- modal ---------- */

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nuevo pedido"
        selCliente.value = ""
        if (inBuscarCliente) inBuscarCliente.value = ""
        for (const opt of selCliente.options) opt.hidden = false
        selCliente.disabled = false
        if (btnNuevoCliente) btnNuevoCliente.hidden = false
        selTipo.value = tipos[0]?.ID_TipoAtencion ?? ""
        selTipo.disabled = false
        inComensales.value = 1
        inObservacion.value = ""
        if (campoEstado) campoEstado.hidden = true
        if (fieldsetItems) fieldsetItems.hidden = false
        items.clear()
        obtenerPanelProductos().replaceChildren()
        if (panelVacio) {
            panelVacio.hidden = false
            panelVacio.textContent = "Selecciona productos para agregar al pedido."
        }
        if (elTotal) elTotal.textContent = monto(0)
        pintarProductos()
        abrirModal(modal, selCliente)
    }

    function abrirEdicion(id) {
        const pedido = pedidos.find(p => String(p.ID_Pedido) === String(id))
        if (!pedido) return
        editandoId = id
        titulo.textContent = "Editar pedido"
        selCliente.value = pedido.ID_Cliente ?? ""
        // el cliente y el tipo no se cambian despues: dar de alta otro pedido
        selCliente.disabled = true
        if (btnNuevoCliente) btnNuevoCliente.hidden = true
        selTipo.value = pedido.ID_TipoAtencion ?? ""
        selTipo.disabled = true
        if (selEstado) selEstado.value = pedido.Situacion || "P"
        if (campoEstado) campoEstado.hidden = false
        inComensales.value = pedido.N_Comensales ?? 1
        inObservacion.value = pedido.Observacion || ""
        // las lineas no se editan: hacerlo exigiria borrar y recrear el
        // detalle. Se cambian desde el pedido del cliente.
        if (fieldsetItems) fieldsetItems.hidden = true
        abrirModal(modal, selEstado || inComensales)
    }

    async function guardar() {
        btnGuardar.disabled = true
        try {
            if (editandoId) {
                const pedidoActual = pedidos.find(p => String(p.ID_Pedido) === String(editandoId))
                const situacion = selEstado?.value || pedidoActual?.Situacion || "P"
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

                const productosVenta = [...items.values()].map(it => ({
                    ID_Producto: it.ID_Producto,
                    Cantidad: it.Cantidad,
                    Precio: it.Precio
                }))

                if (!productosVenta.length) return notifyWarning("Añade al menos un producto")
                if (productosVenta.some(it => !it.Cantidad || it.Cantidad < 1)) {
                    return notifyWarning("Todas las cantidades deben ser al menos 1")
                }

                const resultado = await orderService.crearPedidoManual({
                    ID_Cliente: idCliente,
                    ID_Usuario: miIdUsuario,
                    ID_TipoAtencion: Number(selTipo.value),
                    N_Comensales: Number(inComensales.value) || 1,
                    Observacion: inObservacion.value.trim(),
                    USUCRE: idUsuarioActual,
                    items: productosVenta,
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

    /* Guarda el pedido y, en lugar de cerrar, navega a Ventas con ese pedido
       preseleccionado para facturarlo inmediatamente. */
    async function guardarYProcesarVenta() {
        if (editandoId) {
            return notifyWarning("No se puede procesar una venta desde una edición de pedido")
        }
        const idCliente = Number(selCliente.value)
        if (!idCliente) return notifyWarning("Selecciona un cliente")

        const productosVenta = [...items.values()].map(it => ({
            ID_Producto: it.ID_Producto,
            Cantidad: it.Cantidad,
            Precio: it.Precio
        }))

        if (!productosVenta.length) return notifyWarning("Añade al menos un producto")
        if (productosVenta.some(it => !it.Cantidad || it.Cantidad < 1)) {
            return notifyWarning("Todas las cantidades deben ser al menos 1")
        }

        btnGuardar.disabled = true
        try {
            const resultado = await orderService.crearPedidoManual({
                ID_Cliente: idCliente,
                ID_Usuario: miIdUsuario,
                ID_TipoAtencion: Number(selTipo.value),
                N_Comensales: Number(inComensales.value) || 1,
                Observacion: inObservacion.value.trim(),
                USUCRE: idUsuarioActual,
                items: productosVenta,
            })
            if (!resultado.ok) {
                console.error("Error al crear pedido:", resultado.error)
                return notifyError(resultado.error?.message || "No se pudo crear el pedido")
            }
            notifySuccess("Pedido creado")
            sessionStorage.setItem("rodilla:pedido_para_venta", String(resultado.data.ID_Pedido))
            window.location.hash = "#/dashboard/ventas"
        } finally {
            btnGuardar.disabled = false
        }
    }

    async function eliminar(id) {
        const pedido = pedidos.find(p => String(p.ID_Pedido) === String(id))
        if (!pedido) return
        const n = (pedido.DETALLE_PEDIDO || []).length
        confirmarBorrado({
            titulo: "Eliminar pedido",
            cuerpo: `<p>Se eliminara el pedido${n ? ` y sus ${n} linea${n === 1 ? "" : "s"}` : ""}.</p>
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

    if (btnNuevoCliente) btnNuevoCliente.addEventListener("click", crearClienteRapido)

    modal.querySelector("#pedidos-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    btnGuardar.addEventListener("click", guardar)
    const btnGuardarVenta = modal.querySelector("#pedidos-modal-guardar-venta")
    if (btnGuardarVenta) {
        btnGuardarVenta.addEventListener("click", guardarYProcesarVenta)
    }
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })
    modal.addEventListener("keydown", e => {
        if (e.key !== "Enter" || e.target.tagName !== "INPUT") return
        // No guardar al escribir en el buscador o en el contador de productos
        if (e.target.type === "search" || e.target.closest(".venta-producto-card")) return
        guardar()
    })

    /* Productos: eventos delegados al modal, así funcionan aunque el panel
       se haya creado como fallback o el HTML haya cambiado. */
    modal.addEventListener("click", e => {
        const btn = e.target.closest(".btn-producto-cant")
        if (!btn) return
        const id = Number(btn.dataset.id)
        const accion = btn.dataset.accion
        if (accion === "agregar") cambiarCantidad(id, 1)
        else if (accion === "restar") cambiarCantidad(id, -1)
    })

    modal.addEventListener("input", e => {
        const input = e.target.closest(".venta-producto-card__cantidad-input")
        if (!input) return
        const id = Number(input.dataset.id)
        const valor = Number(input.value) || 0
        const p = productos.find(x => x.ID_Producto === id)
        if (!p) return
        const stock = p.Stock_Actual != null ? Number(p.Stock_Actual) : null
        let nueva = valor
        if (nueva < 0) nueva = 0
        if (stock != null && nueva > stock) {
            notifyWarning(`Stock disponible: ${stock}`)
            nueva = stock
            input.value = nueva
        }
        if (nueva === 0) {
            items.delete(id)
        } else {
            items.set(id, { ID_Producto: id, Cantidad: nueva, Precio: Number(p.Precio || 0), nombre: p.N_Producto, Imagen: p.Imagen })
        }

        // No se repinta todo el panel en cada tecla: se perdería el foco del
        // input. Se actualiza la tarjeta y el total; el repintado completo
        // ocurre en "change".
        const card = input.closest(".venta-producto-card")
        if (card) {
            card.classList.toggle("seleccionado", nueva > 0)
            const subtotalEl = card.querySelector(".venta-producto-card__subtotal")
            if (subtotalEl) {
                subtotalEl.textContent = nueva > 0
                    ? `S/ ${formatearPrecio(nueva * Number(p.Precio || 0))}`
                    : ""
            }
        }
        pintarTotal()
    })

    modal.addEventListener("change", e => {
        if (e.target.closest(".venta-producto-card__cantidad-input")) pintarProductos()
    })

    if (inBuscarProducto) {
        inBuscarProducto.addEventListener("input", pintarProductos)
    }

    const cerrarDetalle = contenedor.querySelector("#pedidos-detalle-cerrar")
    cerrarDetalle.addEventListener("click", () => cerrarModal(detalleModal))
    detalleModal.addEventListener("click", e => { if (e.target === detalleModal) cerrarModal(detalleModal) })

    const cleanup = cerrarConEscape(modal, detalleModal)
    pintarTabla()

    return cleanup
}

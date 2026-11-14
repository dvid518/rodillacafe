import { ventaService } from "../../services/ventaService.js"
import { clientService } from "../../services/clientService.js"
import { dniService } from "../../services/dniService.js"
import { rucService } from "../../services/rucService.js"
import { cajaService } from "../../services/cajaService.js"
import { supabase } from "../../lib/supabaseClient.js"
import { VentaAdapter } from "../../adapters/VentaAdapter.js"

import { userService } from "../../services/userService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio, formatearFecha } from "../../utils/format.js"
import { poblarClientes, nombreUsuario } from "./crud-comun.js"
import { unwrapEmbed } from "../../utils/supabaseHelpers.js"

const ESTADO_VENTA = { E: "Emitida", X: "Anulada", A: "Anulada", P: "Pendiente", C: "Completada" }

/* TipoDocumento de VENTA: 01 = Factura, 03 = Boleta */
const TIPO_DOCUMENTO = { "01": "Factura", "03": "Boleta" }

/* Cliente genérico para boletas simples (sin DNI). ID_Cliente es NOT NULL en VENTA. */
const ID_CLIENTE_CONSUMIDOR_FINAL = 67

export async function ventasController(contenedor) {

    let ventasR = { ok: false }
    let ventas = ventasR.ok ? ventasR.data : []
    let cargandoVentas = true

    const tbodyEl = contenedor.querySelector("#ventas-tbody")
    try {
        pintarTabla()
    } catch (error) {
        console.error("Error pintando la tabla de ventas:", error)
    }

    let clientesR = { ok: false }
    let usuariosR = { ok: false }
    let sesion = { ok: false }
    let usucre = "WEB"
    let clientes = []
    let usuarios = []
    const usuariosPorId = new Map((usuarios || []).map(u => [u.ID_Usuario, u]))
    const usuarioPorLogeo = new Map((usuarios || []).map(u => [u.Logeo, u]))
    let metodosPago = []
    /* ID del metodo de pago que es efectivo, para habilitar el campo de
       efectivo recibido solo cuando corresponda. */
    let idMetodoEfectivo = null
    let editandoId = null

    /* Apertura abierta en memoria (para mostrarla en el modal) */
    let aperturaAbierta = null

    const modalEl = contenedor.querySelector("#ventas-modal")
    const selCliente = modalEl.querySelector("#ventas-input-cliente")
    const selPedido = modalEl.querySelector("#ventas-input-pedido")
    const inBuscarPedido = modalEl.querySelector("#ventas-buscar-pedido")
    const avisoPedido = modalEl.querySelector("#venta-aviso-pedido")
    const selPago = modalEl.querySelector("#ventas-input-pago")
    const inBuscarCliente = modalEl.querySelector("#ventas-buscar-cliente")
    const listaPedido = modalEl.querySelector("#venta-lista-pedido")
    const avisoSinPedido = modalEl.querySelector("#venta-aviso-sin-pedido")
    const elTotal = modalEl.querySelector("#ventas-total")
    const elSubtotal = modalEl.querySelector("#ventas-subtotal")
    const elIgv = modalEl.querySelector("#ventas-igv")
    const elContador = modalEl.querySelector("#venta-contador-productos")
    const resumenEl = modalEl.querySelector("#venta-resumen")
    const inPagado = modalEl.querySelector("#ventas-input-pagado")
    const divEfectivoEstado = modalEl.querySelector("#venta-efectivo-estado")
    const divEfectivoVuelto = modalEl.querySelector("#venta-efectivo-vuelto")
    const btnGuardar = modalEl.querySelector("#ventas-modal-guardar")
    const btnCancelar = modalEl.querySelector("#ventas-modal-cancelar")
    const btnNuevo = contenedor.querySelector("#ventas-nuevo")

    // Los controles de cierre/guardado quedan conectados antes de cargar datos.
    btnCancelar?.addEventListener("click", cerrarModal)
    btnGuardar?.addEventListener("click", guardar)
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    const onEscape = e => {
        if (e.key !== "Escape") return
        if (!modalEl.hidden) cerrarModal()
        if (!detModalEl?.hidden) {
            detModalEl.hidden = true
            document.body.classList.remove("sin-scroll")
        }
    }
    window.addEventListener("keydown", onEscape)

    btnNuevo?.addEventListener("click", async (e) => {

        await abrirNuevo()
    })
    const btnNuevoCliente = modalEl.querySelector("#ventas-nuevo-cliente")
    const cajaEstado = modalEl.querySelector("#ventas-caja-estado")
    const titulo = modalEl.querySelector("#ventas-modal-titulo")

    /* Documento / cliente por DNI o RUC */
    const radiosTipoDoc = modalEl.querySelectorAll('input[name="ventas-tipo-doc"]')
    const campoDocumento = modalEl.querySelector("#venta-documento-campo")
    const inDocumento = modalEl.querySelector("#ventas-input-documento")
    const btnBuscarDocumento = modalEl.querySelector("#ventas-buscar-documento")
    const avisoDocumento = modalEl.querySelector("#venta-aviso-documento")
    const campoClienteEncontrado = modalEl.querySelector("#venta-cliente-encontrado")
    const clienteNombreEl = modalEl.querySelector("#venta-cliente-nombre")
    const clienteDocEl = modalEl.querySelector("#venta-cliente-doc")
    const clienteIdInput = modalEl.querySelector("#venta-cliente-id")

    /* Aviso HTML debajo del campo de documento para cliente no registrado */
    const avisoAgregarCliente = modalEl.querySelector("#venta-aviso-agregar-cliente")
    const avisoAgregarTitulo = modalEl.querySelector("#venta-aviso-agregar-titulo")
    const avisoAgregarMensaje = modalEl.querySelector("#venta-aviso-agregar-mensaje")
    const btnAgregarCliente = modalEl.querySelector("#venta-btn-agregar-cliente")

    /* Datos del cliente externo (DNI/RUC) pendiente de agregarse a BD */
    let clienteExternoPendiente = null

    /* Pedido seleccionado (con DETALLE_PEDIDO embebido) */
    let pedidoSeleccionado = null

    /* Items del detalle de venta abierto (para descargar PDF) */
    let itemsDetalleActual = []

    /* Cliente resuelto por DNI/RUC (se rellena al buscar) */
    let clientePorDocumento = null

    /* Modal de detalle */
    const detModalEl = contenedor.querySelector("#ventas-detalle-modal")
    const detId = detModalEl.querySelector("#det-venta-id")
    const detFecha = detModalEl.querySelector("#det-venta-fecha")
    const detCliente = detModalEl.querySelector("#det-venta-cliente")
    const detDocumento = detModalEl.querySelector("#det-venta-documento")
    const detMetodo = detModalEl.querySelector("#det-venta-metodo")
    const detTotal = detModalEl.querySelector("#det-venta-total")
    const detItems = detModalEl.querySelector("#det-venta-items")
    const detSubtotal = detModalEl.querySelector("#det-subtotal")
    const detIgv = detModalEl.querySelector("#det-igv")
    const detTotalLabel = detModalEl.querySelector("#det-total")
    const btnDetCerrar = detModalEl.querySelector("#ventas-detalle-cerrar")

    /* ---------- catálogos de caja ---------- */

    async function cargarCaja() {
        const [rApertura, rPagos] = await Promise.all([
            cajaService.obtenerAperturaAbierta(),
            cajaService.listarMetodosPago(),
        ])
        if (rApertura.ok && rApertura.data) {
            aperturaAbierta = rApertura.data
            const a = aperturaAbierta
            const caja = unwrapEmbed(a.CAJA)?.N_Caja || "Caja"
            cajaEstado.innerHTML = `
                <span class="venta-caja__estado--activo">${icono("circle-check", { size: 14 })} Turno ${a.Numero_Turno} — ${escaparHTML(caja)}</span>
            `
        } else {
            aperturaAbierta = null
            cajaEstado.innerHTML = `
                <button class="btn btn--primary btn-abrir-caja" type="button" id="ventas-abrir-caja">
                    ${icono("plus", { size: 14 })} Abrir caja
                </button>
                <span class="venta-caja__estado--cerrado">No hay turno aperturado</span>
            `
            const btnAbrir = cajaEstado.querySelector("#ventas-abrir-caja")
            if (btnAbrir) {
                btnAbrir.addEventListener("click", () => {
                    notifyWarning("Abre un turno en la pestaña Caja antes de registrar una venta.")
                })
            }
        }
        if (rPagos.ok) {
            metodosPago = rPagos.data || []
            idMetodoEfectivo = null
            selPago.replaceChildren(
                ...metodosPago.map(m => {
                    const o = document.createElement("option")
                    o.value = m.ID_MetodoPago
                    o.textContent = escaparHTML(m.N_MetodoPago || "Pago")
                    if (String(m.Es_Efectivo) === "1") idMetodoEfectivo = m.ID_MetodoPago
                    return o
                })
            )
            actualizarCampoEfectivo(selPago.value)
        }
    }

    function fechaLegible(iso) {
        return formatearFecha(iso, { dateStyle: "short", timeStyle: "short" }).replace(/, /g, " ")
    }

    /* ---------- efectivo recibido y vuelto ---------- */

    /** Habilita el campo de efectivo recibido solo si el metodo de pago es efectivo. */
    function actualizarCampoEfectivo(idMetodoPago) {
        const esEfectivo = Number(idMetodoPago) === Number(idMetodoEfectivo)
        const campo = modalEl.querySelector("#venta-efectivo-campo")
        if (campo) campo.hidden = !esEfectivo
        if (inPagado) {
            inPagado.disabled = !esEfectivo
            if (!esEfectivo) {
                inPagado.value = ""
                if (divEfectivoEstado) divEfectivoEstado.textContent = ""
                if (divEfectivoVuelto) divEfectivoVuelto.textContent = ""
            }
        }
        if (divEfectivoEstado) divEfectivoEstado.hidden = !esEfectivo
        if (divEfectivoVuelto) divEfectivoVuelto.hidden = !esEfectivo
    }

    /** Calcula y muestra si el efectivo recibido cubre el total y el vuelto. */
    function calcularVuelto() {
        if (!inPagado || !divEfectivoEstado || !divEfectivoVuelto) return
        const esEfectivo = Number(selPago.value) === Number(idMetodoEfectivo)
        if (!esEfectivo || !inPagado.value) {
            divEfectivoEstado.textContent = ""
            divEfectivoVuelto.textContent = ""
            return
        }
        const pagado = Number(inPagado.value) || 0
        const total = Number(elTotal?.textContent?.replace(/[S\/,\s]/g, "") || 0) || 0
        const suficiente = pagado >= total
        const vuelto = suficiente ? pagado - total : 0

        if (suficiente) {
            divEfectivoEstado.textContent = `Efectivo recibido cubre el total`
            divEfectivoEstado.style.color = "var(--state-success)"
            divEfectivoVuelto.textContent = `Vuelto: S/ ${formatearPrecio(vuelto)}`
            divEfectivoVuelto.style.color = "var(--state-success)"
        } else {
            const faltante = total - pagado
            divEfectivoEstado.textContent = `Insuficiente: faltan S/ ${formatearPrecio(faltante)}`
            divEfectivoEstado.style.color = "var(--state-danger)"
            divEfectivoVuelto.textContent = `Vuelto: S/ 0.00`
            divEfectivoVuelto.style.color = "var(--state-danger)"
        }
    }

    /* ---------- tabla de ventas ---------- */

    function nombreClienteDe(venta) {
        const cliente = unwrapEmbed(venta.CLIENTE)
        const idCliente = venta.ID_Cliente ?? cliente?.ID_Cliente

        if (Number(idCliente) === ID_CLIENTE_CONSUMIDOR_FINAL) return "Consumidor Final"

        const persona = unwrapEmbed(cliente?.PERSONA)
        const nombre = [persona?.Nombre, persona?.Ap_Paterno].filter(Boolean).join(" ").trim()
        if (nombre) return nombre

        const empresa = unwrapEmbed(cliente?.EMPRESA)
        if (empresa?.Razon_Social) return empresa.Razon_Social

        return idCliente != null ? `Cliente #${idCliente}` : "Consumidor Final"
    }

    function metodoPagoDe(venta) {
        const pago = unwrapEmbed(venta.PAGO_VENTA)
        return unwrapEmbed(pago?.METODO_PAGO)?.N_MetodoPago || "-"
    }

    function tipoDocumentoDe(venta) {
        const tipo = String(venta.TipoDocumento || "").trim()
        if (!tipo) return "-"
        return TIPO_DOCUMENTO[tipo.padStart(2, "0")] || tipo
    }

    function pintarTabla() {
        if (cargandoVentas) {
            tbodyEl.innerHTML = Array(3).fill(`<tr>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--texto skeleton--corto"></span></td>
                <td><span class="skeleton skeleton--icono"></span></td>
                <td><span class="skeleton skeleton--icono"></span></td>
            </tr>`).join("")
            return
        }
        if (!ventasR.ok) {
            tbodyEl.innerHTML = `<tr class="fila-vacia"><td colspan="8">Error al cargar ventas: ${escaparHTML(ventasR.error?.message || ventasR.error?.details || "error desconocido")}</td></tr>`
            return
        }
        if (!ventas.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="8">No hay ventas. Registra la primera.</td></tr>'
            return
        }

        tbodyEl.innerHTML = ventas.map(v => {
            const apertura = unwrapEmbed(v.APERTURA_CAJA)
            const cajaNombre = unwrapEmbed(apertura?.CAJA)?.N_Caja || ""
            const cajaTexto = apertura
                ? `Turno ${escaparHTML(String(apertura.Numero_Turno ?? "—"))}${cajaNombre ? ` / ${escaparHTML(cajaNombre)}` : ""}`
                : "—"
            return `
                <tr data-id="${v.ID_Venta}">
                    <td>#${v.ID_Venta}</td>
                    <td>${escaparHTML(fechaLegible(v.F_Venta))}</td>
                    <td>${escaparHTML(nombreClienteDe(v))}</td>
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

    /* ---------- detalle del pedido a facturar (solo lectura) ---------- */

    function actualizarResumen(subTotal = 0, igv = 0, total = 0) {
        if (elSubtotal) elSubtotal.textContent = `S/ ${formatearPrecio(subTotal)}`
        if (elIgv) elIgv.textContent = `S/ ${formatearPrecio(igv)}`
        if (elTotal) elTotal.textContent = `S/ ${formatearPrecio(total)}`
    }

    function renderizarDetallePedido(pedido) {
        listaPedido.replaceChildren()
        const lineas = Array.isArray(pedido?.DETALLE_PEDIDO) ? pedido.DETALLE_PEDIDO : []
        const totalUnidades = lineas.reduce((sum, d) => sum + Number(d.Cantidad || 0), 0)

        if (elContador) {
            elContador.textContent = String(totalUnidades)
            elContador.title = `${totalUnidades} ${totalUnidades === 1 ? "producto" : "productos"}`
        }
        if (resumenEl) resumenEl.hidden = !lineas.length

        if (!lineas.length) {
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = "El pedido seleccionado no tiene productos."
            actualizarResumen()
            return { subTotal: 0, igv: 0, total: 0 }
        }

        avisoSinPedido.hidden = true

        let subTotal = 0
        for (const d of lineas) {
            const cantidad = Number(d.Cantidad || 0)
            const precio = Number(d.Precio || 0)
            const subtotal = d.Sub_Total != null ? Number(d.Sub_Total) : cantidad * precio
            subTotal += subtotal
            const producto = unwrapEmbed(d.PRODUCTO) || {}
            const nombre = escaparHTML(producto.N_Producto || `Producto ${d.ID_Producto}`)

            const fila = document.createElement("div")
            fila.className = "venta-lista-pedido__fila"
            fila.innerHTML = `
                <span class="venta-lista-pedido__cantidad">×${cantidad}</span>
                <span class="venta-lista-pedido__nombre">${nombre}</span>
                <span class="venta-lista-pedido__precio">S/ ${formatearPrecio(precio)}</span>
                <span class="venta-lista-pedido__subtotal">S/ ${formatearPrecio(subtotal)}</span>
            `
            listaPedido.appendChild(fila)
        }

        const igv = Number((subTotal * 0.18).toFixed(2))
        const total = Number((subTotal + igv).toFixed(2))
        actualizarResumen(subTotal, igv, total)
        return { subTotal, igv, total }
    }

    async function seleccionarPedido(idPedido) {
        if (!idPedido) {
            pedidoSeleccionado = null
            listaPedido.replaceChildren()
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = "Selecciona un pedido para ver sus productos."
            if (elContador) {
                elContador.textContent = "0"
                elContador.title = "0 productos"
            }
            if (resumenEl) resumenEl.hidden = true
            actualizarResumen()
            return
        }

        listaPedido.replaceChildren()
        avisoSinPedido.hidden = false
        avisoSinPedido.textContent = "Cargando productos del pedido…"
        /* Pedido y detalle se consultan directamente, sin depender de mapas en memoria. */
        const { data: pedido, error } = await supabase
            .from("PEDIDO")
            .select(`
                ID_Pedido,
                ID_Cliente,
                Total,
                Situacion,
                CLIENTE ( ID_Cliente, PERSONA ( Nombre, Ap_Paterno ) ),
                DETALLE_PEDIDO (
                    ID_DetallePedido,
                    ID_Producto,
                    Cantidad,
                    Precio,
                    Sub_Total,
                    PRODUCTO ( N_Producto )
                )
            `)
            .eq("ID_Pedido", Number(idPedido))
            .single()

        if (error || !pedido) {
            console.error("Error cargando detalle del pedido:", error)
            notifyError("No se pudo cargar el detalle del pedido: " + (error?.message || "error desconocido"))
            listaPedido.replaceChildren()
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = "No se pudo cargar el detalle del pedido."
            if (elContador) {
                elContador.textContent = "0"
                elContador.title = "0 productos"
            }
            if (resumenEl) resumenEl.hidden = true
            actualizarResumen()
            return
        }

        pedidoSeleccionado = pedido

        /* Si el embed DETALLE_PEDIDO no trajo datos (posible RLS sobre la tabla
           intermedia), hacer una consulta separada a DETALLE_PEDIDO por ID_Pedido. */
        const { data: detallesRaw, error: errDetalles } = await supabase
            .from("DETALLE_PEDIDO")
            .select(`
                    ID_DetallePedido,
                    ID_Producto,
                    Cantidad,
                    Precio,
                    Sub_Total,
                    PRODUCTO ( N_Producto )
            `)
            .eq("ID_Pedido", Number(idPedido))
        if (errDetalles) {
            pedidoSeleccionado = null
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = `No se pudieron cargar los productos: ${errDetalles.message || "error de permisos/RLS"}`
            notifyError(avisoSinPedido.textContent)
            return
        }
        /* DETALLE_PEDIDO es uno-a-muchos: NO usar unwrapEmbed (que solo devuelve
           el primer elemento). Asignar el array completo de detalles. */
        const detalles = Array.isArray(detallesRaw) ? detallesRaw : (detallesRaw ? [detallesRaw] : [])
        pedido.DETALLE_PEDIDO = detalles

        renderizarDetallePedido(pedido)

        /* Selecciona por defecto el cliente que ya trae el pedido.
           Se puede cambiar libremente después desde el select de clientes. */
        if (pedido.ID_Cliente && selCliente) {
            const idClienteStr = String(pedido.ID_Cliente);
            const opcionExiste = [...selCliente.options].some(o => String(o.value) === idClienteStr);
            if (opcionExiste) {
                selCliente.value = idClienteStr;
                selCliente.dispatchEvent(new Event('change'));
            } else {
                console.warn("Cliente del pedido no está en la lista:", pedido.ID_Cliente);
            }
        }

        // Si es boleta con DNI o factura y hay un pedido seleccionado, buscar el cliente automáticamente
        const activoTipoDoc = [...radiosTipoDoc].find(r => r.checked)
        if ((activoTipoDoc.value === "dni" || activoTipoDoc.value === "ruc") && pedido) {
            buscarYMostrarClientePorPedido(pedido)
        }
    }

    /* Mapa ID_Pedido -> objeto pedido (con DETALLE_PEDIDO embebido).
       Se mantiene solo para pintar el select de pedidos; seleccionarPedido ya
       no depende de él. */
    const pedidosPorId = new Map()
    /* Lista completa de pedidos pendientes; el select se repinta filtrado */
    let pedidosPendientes = []

    /* ---------- modal ---------- */

    async function abrirNuevo() {

        editandoId = null
        titulo.textContent = "Nueva venta"
        selCliente.value = ""
        inBuscarCliente.value = ""
        for (const opt of selCliente.options) opt.hidden = false
        const tipoDocBoleta = modalEl.querySelector('input[name="ventas-tipo-doc"][value="simple"]')
        if (tipoDocBoleta) tipoDocBoleta.checked = true
        selPago.value = ""
        inPagado.value = ""
        actualizarCampoEfectivo(selPago.value)
        if (inBuscarPedido) inBuscarPedido.value = ""
        selPedido.value = ""
        pedidoSeleccionado = null
        listaPedido.replaceChildren()
        avisoSinPedido.hidden = false
        avisoSinPedido.textContent = "Selecciona un pedido para ver sus productos."
        if (elContador) {
            elContador.textContent = "0"
            elContador.title = "0 productos"
        }
        if (resumenEl) resumenEl.hidden = true
        actualizarResumen()

        try {
            await cargarPedidosPendientes()
        } catch (error) {
            console.warn("No se pudieron cargar los pedidos pendientes:", error)
            if (avisoPedido) {
                avisoPedido.hidden = false
                avisoPedido.textContent = `No se pudieron cargar pedidos: ${error.message || "error de permisos/RLS"}`
            }
            selPedido.disabled = true
        }

        try {
            const { data, error } = await supabase.from("CLIENTE").select("ID_Cliente, Tipo_Cliente, PERSONA ( Nombre, Ap_Paterno, N_Documento ), EMPRESA ( Razon_Social, RUC )").order("ID_Cliente")
            if (error) throw error
            clientes = data || []
            poblarClientes(selCliente, clientes)
        } catch (error) {
            console.error("Error cargando clientes para venta:", error)
            selCliente.replaceChildren(new Option("No se pudieron cargar clientes", ""))
            notifyError(`No se pudieron cargar los clientes${error.message ? `: ${error.message}` : " (verifica permisos/RLS)"}`)
        }

        // Cargar turno de caja cada vez que se abre el modal
        try {
            await cargarCaja()
        } catch (error) {
            console.warn("No se pudo cargar la caja al abrir el modal:", error)
        }

        // Si venimos de "Guardar y procesar venta" desde Pedidos, preseleccionar ese pedido
        const idPedidoPreseleccionado = sessionStorage.getItem("rodilla:pedido_para_venta")
        if (idPedidoPreseleccionado) {
            sessionStorage.removeItem("rodilla:pedido_para_venta")
            if (inBuscarPedido) inBuscarPedido.value = ""
            // pintarOpcionesPedidos (dentro de cargarPedidosPendientes) ya restaura el
            // valor si el pedido sigue en la lista filtrada; ahora aseguramos el detalle.
            selPedido.value = idPedidoPreseleccionado
            try { await seleccionarPedido(idPedidoPreseleccionado) }
            catch (error) {
                console.error("Error precargando pedido:", error)
                avisoSinPedido.hidden = false
                avisoSinPedido.textContent = `No se pudo cargar el pedido: ${error.message || "error desconocido"}`
            }
            // Asegurar que el select muestre el pedido preseleccionado visualmente
            // (después de que cargarPedidosPendientes pobló las opciones)
            selPedido.value = idPedidoPreseleccionado
        }

        cambiarTipoDocumento()

        modalEl.hidden = false

        document.body.classList.add("sin-scroll")
        selPedido.focus()
    }

    /* Texto de una opción del select: ID, fecha, cliente y total. */
    function textoPedido(p) {
        const clienteObj = unwrapEmbed(p.CLIENTE)
        const personaObj = unwrapEmbed(clienteObj?.PERSONA)
        const nomCliente = personaObj
            ? `${personaObj.Nombre || ""} ${personaObj.Ap_Paterno || ""}`.trim()
            : (clienteObj?.ID_Cliente
                ? `Cliente #${clienteObj.ID_Cliente}`
                : `Cliente #${p.ID_Cliente}`)
        const fecha = formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" })
        const total = `S/ ${formatearPrecio(p.Total || 0)}`
        return `#${p.ID_Pedido} · ${fecha} · ${nomCliente} · ${total}`
    }

    /* Repinta el select aplicando el filtro del buscador. Se reconstruye en
       vez de usar option.hidden: así el filtrado funciona igual en todos los
       navegadores y el texto se puede buscar por ID, fecha, cliente o total. */
    function pintarOpcionesPedidos() {
        const q = (inBuscarPedido?.value || "").trim().toLowerCase()
        const seleccionado = selPedido.value

        selPedido.replaceChildren()

        if (!pedidosPendientes.length) {
            const o = document.createElement("option")
            o.value = ""
            o.disabled = true
            o.textContent = "No hay pedidos pendientes"
            selPedido.appendChild(o)
            selPedido.disabled = true
            if (avisoPedido) avisoPedido.hidden = false
            btnGuardar.disabled = true
            return
        }

        selPedido.disabled = false
        if (avisoPedido) avisoPedido.hidden = true
        btnGuardar.disabled = false

        const filtrados = q
            ? pedidosPendientes.filter(p => textoPedido(p).toLowerCase().includes(q))
            : pedidosPendientes

        const optVacio = document.createElement("option")
        optVacio.value = ""
        optVacio.textContent = filtrados.length ? "Selecciona un pedido" : "Sin resultados"
        selPedido.appendChild(optVacio)

        for (const p of filtrados) {
            const o = document.createElement("option")
            o.value = p.ID_Pedido
            o.textContent = textoPedido(p)
            selPedido.appendChild(o)
        }

        // Si el pedido seleccionado sigue visible, se conserva; si el filtro
        // lo oculta, se limpia también el detalle para no facturar a ciegas.
        if (seleccionado && filtrados.some(p => String(p.ID_Pedido) === String(seleccionado))) {
            selPedido.value = seleccionado
        } else {
            selPedido.value = ""
            if (seleccionado) seleccionarPedido("")
        }
    }

    async function cargarPedidosPendientes() {
        const { data, error } = await supabase.from("PEDIDO").select(`ID_Pedido, ID_Cliente, Situacion, F_Pedido, Total, CLIENTE ( ID_Cliente, PERSONA ( Nombre, Ap_Paterno ) )`).in("Situacion", ["P", "A"]).order("F_Pedido", { ascending: false })
        if (error) throw error
        const { data: ventasFacturadas, error: errorVentas } = await supabase.from("VENTA").select("ID_Pedido").not("ID_Pedido", "is", null)
        if (errorVentas) throw errorVentas
        const facturados = new Set((ventasFacturadas || []).map(v => Number(v.ID_Pedido)))
        pedidosPendientes = (data || []).filter(p => !facturados.has(Number(p.ID_Pedido)))
        pedidosPorId.clear()
        for (const p of pedidosPendientes) pedidosPorId.set(Number(p.ID_Pedido), p)

        pintarOpcionesPedidos()
    }

    /* ---------- tipo de documento y búsqueda por DNI/RUC ---------- */

    function cambiarTipoDocumento() {
        const activo = [...radiosTipoDoc].find(r => r.checked)
        const esConDocumento = activo && (activo.value === "dni" || activo.value === "ruc")
        const esSimple = activo && activo.value === "simple"

        if (campoDocumento) campoDocumento.hidden = !esConDocumento
        if (campoClienteEncontrado) campoClienteEncontrado.hidden = true

        clientePorDocumento = null
        clienteIdInput.value = ""
        clienteNombreEl.textContent = ""
        clienteDocEl.textContent = ""
        inDocumento.value = ""
        if (avisoDocumento) avisoDocumento.textContent = ""
        if (avisoAgregarCliente) avisoAgregarCliente.hidden = true
        clienteExternoPendiente = null

        // Aviso informativo de Consumidor Final (solo boleta simple)
        const avisoCF = document.getElementById("venta-aviso-consumidor-final")
        if (avisoCF) avisoCF.hidden = !esSimple

        // Si es boleta simple, limpiar cliente del select también
        if (esSimple) {
            selCliente.value = ""
        }

        // Si se selecciona boleta con DNI o factura y hay un pedido seleccionado,
        // buscar automáticamente el cliente del pedido
        if ((activo.value === "dni" || activo.value === "ruc") && pedidoSeleccionado) {
            buscarYMostrarClientePorPedido(pedidoSeleccionado)
        }
    }

    async function buscarYMostrarClientePorPedido(pedido) {
        if (!pedido) return

        const clienteObj = unwrapEmbed(pedido.CLIENTE)
        if (!clienteObj) return

        const idCliente = clienteObj.ID_Cliente
        const cliente = clientes.find(c => c.ID_Cliente === idCliente)

        if (!cliente) {
            notifyWarning("El cliente no existe en la base de datos")
            return
        }

        // Determinar el documento y tipo según sea persona o empresa
        const persona = cliente.PERSONA?.[0]
        const empresa = cliente.EMPRESA?.[0]

        let documento = ""
        let tipoDoc = ""

        if (persona) {
            documento = persona.N_Documento || ""
            tipoDoc = "dni"
        } else if (empresa) {
            documento = empresa.RUC || ""
            tipoDoc = "ruc"
        }

        if (!documento) {
            notifyWarning("El cliente no tiene documento asociado")
            return
        }

        // Llenar datos del cliente encontrado
        clientePorDocumento = cliente
        clienteIdInput.value = idCliente
        clienteNombreEl.textContent = tipoDoc === "ruc"
            ? (unwrapEmbed(cliente.EMPRESA)?.Razon_Social || "")
            : `${unwrapEmbed(cliente.PERSONA)?.Nombre || ""} ${unwrapEmbed(cliente.PERSONA)?.Ap_Paterno || ""}`.trim()
        clienteDocEl.textContent = `${esRUC ? "RUC" : "DNI"}: ${documento}`
        if (avisoDocumento) {
            avisoDocumento.textContent = "Cliente encontrado en la base de datos"
            avisoDocumento.style.color = "var(--state-success)"
        }
        if (campoClienteEncontrado) campoClienteEncontrado.hidden = false
    }

    async function buscarDocumento() {
        const doc = String(inDocumento.value || "").trim()
        if (!doc) {
            notifyWarning("Ingresa un número de documento")
            return
        }

        const esRUC = doc.length === 11
        const esDNI = doc.length === 8

        if (!esRUC && !esDNI) {
            notifyWarning("El documento debe tener 8 dígitos (DNI) o 11 (RUC)")
            return
        }

        btnBuscarDocumento.disabled = true
        btnBuscarDocumento.textContent = "Buscando..."

        try {
            let resultado
            if (esRUC) {
                resultado = await rucService.consultarRUC(doc)
            } else {
                resultado = await dniService.consultarDNI(doc)
            }

            if (!resultado.ok) {
                if (avisoDocumento) {
                    avisoDocumento.textContent = resultado.error?.message || "No se encontró el documento"
                    avisoDocumento.style.color = "var(--state-danger)"
                }
                notifyError(resultado.error?.message || "No se encontró el documento")
                return
            }

            const data = resultado.data

            if (data.yaExiste) {
                // Ya está en BD: necesitamos resolver el ID_Cliente
                const clientes = await clientService.listarClientes()
                let clienteEncontrado = null
                if (clientes.ok) {
                    clienteEncontrado = (clientes.data || []).find(c => {
                        const persona = unwrapEmbed(c.PERSONA)
                        const empresa = unwrapEmbed(c.EMPRESA)
                        if (esRUC && empresa) return empresa.RUC === doc
                        if (esDNI && persona) return persona.N_Documento === doc
                        return false
                    })
                }
                if (!clienteEncontrado) {
                    if (avisoDocumento) {
                        avisoDocumento.textContent = "El documento existe en la base de datos pero no tiene cliente asociado"
                        avisoDocumento.style.color = "var(--state-danger)"
                        avisoDocumento.hidden = false
                    }
                    notifyError("El documento existe en la base de datos pero no tiene cliente asociado")
                    return
                }
                clientePorDocumento = clienteEncontrado
                clienteIdInput.value = clienteEncontrado.ID_Cliente
                const persona = unwrapEmbed(clienteEncontrado.PERSONA)
                const empresa = unwrapEmbed(clienteEncontrado.EMPRESA)
                const nombre = esRUC
                    ? (empresa?.Razon_Social || "Empresa")
                    : `${persona?.Nombre || ""} ${persona?.Ap_Paterno || ""}`.trim()
                clienteNombreEl.textContent = `${nombre} (${esRUC ? "RUC" : "DNI"}: ${doc})`
                clienteDocEl.textContent = ""
                if (avisoDocumento) {
                    avisoDocumento.textContent = "Cliente encontrado en la base de datos"
                    avisoDocumento.style.color = "var(--state-success)"
                    avisoDocumento.hidden = false
                }
                if (campoClienteEncontrado) campoClienteEncontrado.hidden = false
                notifySuccess("Cliente encontrado")
                avisoAgregarCliente?.classList.add("hidden")
            } else {
                // No existe en BD: mostrar aviso HTML debajo del documento
                const nombre = esRUC
                    ? data.razonSocial || data.nombreComercial || ""
                    : `${data.nombres || ""} ${data.apellidoPaterno || ""} ${data.apellidoMaterno || ""}`.trim()

                clienteExternoPendiente = {
                    esRUC,
                    doc,
                    nombre,
                    data
                }

                if (avisoAgregarTitulo) avisoAgregarTitulo.textContent = "Cliente no registrado en la base de datos"
                if (avisoAgregarMensaje) {
                    avisoAgregarMensaje.innerHTML = `
                        Se encontró: <strong>${escaparHTML(nombre)}</strong> (${esRUC ? "RUC" : "DNI"}: ${doc}).<br>
                        Al continuar, el cliente se agregará a la base de datos automáticamente.
                    `
                }
                if (avisoAgregarCliente) avisoAgregarCliente.hidden = false
                if (avisoDocumento) avisoDocumento.hidden = true
                if (campoClienteEncontrado) campoClienteEncontrado.hidden = true
                return
            }
        } catch (err) {
            console.error("Error buscando documento:", err)
            notifyError("Error al consultar el documento")
        } finally {
            btnBuscarDocumento.disabled = false
            btnBuscarDocumento.textContent = "Buscar"
        }
    }

    function cerrarModal() {
        modalEl.hidden = true
        editandoId = null
        modalEl.querySelector("form")?.reset()
        inBuscarPedido && (inBuscarPedido.value = "")
        inBuscarCliente && (inBuscarCliente.value = "")
        selPedido.value = ""
        selCliente.value = ""
        pedidoSeleccionado = null
        clientePorDocumento = null
        clienteExternoPendiente = null
        listaPedido.replaceChildren()
        avisoSinPedido.hidden = false
        avisoSinPedido.textContent = "Selecciona un pedido para ver sus productos."
        if (resumenEl) resumenEl.hidden = true
        actualizarResumen()
        inPagado.value = ""
        if (btnGuardar) btnGuardar.disabled = false
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        if (!aperturaAbierta || !aperturaAbierta.ID_AperturaCaja) {
            return notifyWarning("No hay una caja abierta. Abre un turno antes de registrar la venta.")
        }
        const idApertura = Number(aperturaAbierta.ID_AperturaCaja)
        const idPago = Number(selPago.value)
        const idPedido = Number(selPedido.value) || null
        const tipoDocRaw = modalEl.querySelector('input[name="ventas-tipo-doc"]:checked').value
        const tipoDoc = tipoDocRaw === "ruc" ? "Factura" : "Boleta"

        if (!idPago) return notifyWarning("Selecciona un método de pago")
        if (!idPedido) return notifyWarning("Selecciona un pedido")
        if (!pedidoSeleccionado || !pedidoSeleccionado.DETALLE_PEDIDO?.length) {
            return notifyWarning("El pedido seleccionado no tiene productos para facturar")
        }

        /* Resolver ID_Cliente según tipo de documento */
        let idCliente = null
        if (tipoDocRaw === "dni" || tipoDocRaw === "ruc") {
            if (!clientePorDocumento) {
                return notifyWarning("Busca y selecciona un cliente por DNI/RUC antes de continuar")
            }
            idCliente = clientePorDocumento.ID_Cliente
        } else if (tipoDocRaw === "simple") {
            idCliente = ID_CLIENTE_CONSUMIDOR_FINAL
        }

        /* Los productos vienen del pedido seleccionado (solo lectura).
           facturar_venta lee DETALLE_PEDIDO del pedido. */
        const productosVenta = (pedidoSeleccionado.DETALLE_PEDIDO || []).map(d => ({
            ID_Producto: Number(d.ID_Producto),
            Cantidad: Number(d.Cantidad || 0),
            Precio: Number(d.Precio || 0)
        }))

        const totals = renderizarDetallePedido(pedidoSeleccionado) || { total: 0 } // recalcula el total mostrado
        const esEfectivo = Number(idPago) === Number(idMetodoEfectivo)
        const tPagado = esEfectivo ? (Number(inPagado.value) || 0) : (totals.total || 0)

        if (esEfectivo && tPagado < totals.total) {
            return notifyWarning(`El efectivo recibido (S/ ${formatearPrecio(tPagado)}) es insuficiente para el total (S/ ${formatearPrecio(totals.total)}).`)
        }

        const datos = {
            ID_Cliente: idCliente,
            ID_AperturaCaja: idApertura,
            ID_Pedido: idPedido,
            Total: Number(pedidoSeleccionado.Total || 0),
            TipoDocumento: tipoDoc,
            ID_MetodoPago: idPago,
            Es_Efectivo: esEfectivo ? '1' : '0',
            T_Pagado: tPagado,
            Monto_Recibido: tPagado,
            USUCRE: usucre,
            productos: productosVenta
        }

        btnGuardar.disabled = true
        btnGuardar.textContent = "Registrando…"
        let resultado
        try {
            resultado = await VentaAdapter.crear(datos)
        } catch (error) {
            resultado = { ok: false, error }
        } finally {
            btnGuardar.disabled = false
            btnGuardar.textContent = "Registrar venta"
        }

        if (!resultado.ok) {
            console.error("Error al crear venta:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo registrar la venta")
        }

        notifySuccess("Venta registrada")
        cerrarModal()
        await recargar()
        await cargarCaja()
        // Abrir el detalle de la venta recién creada y generar el PDF automáticamente
        if (resultado.data?.ID_Venta) {
            await verDetalle(resultado.data.ID_Venta)
            await generarYAbrirPDF()
        }
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
        const itemsDet = resultado.data || []

        const venta = ventas.find(v => v.ID_Venta === idVenta)
        if (!venta) return

        const nombreCliente = nombreClienteDe(venta)

        const fecha = fechaLegible(venta.F_Venta)
        const total = Number(venta.Total || 0)
        const subTotal = Number(venta.Sub_Total || 0)
        const igv = Number(venta.IGV || 0)

        detId.textContent = `#${venta.ID_Venta}`
        detFecha.textContent = fecha
        detCliente.textContent = nombreCliente
        if (detDocumento) detDocumento.textContent = tipoDocumentoDe(venta)
        if (detMetodo) detMetodo.textContent = metodoPagoDe(venta)
        detTotal.textContent = `S/ ${total.toFixed(2)}`
        detSubtotal.textContent = `S/ ${subTotal.toFixed(2)}`
        detIgv.textContent = `S/ ${igv.toFixed(2)}`
        detTotalLabel.textContent = `S/ ${total.toFixed(2)}`

        if (!itemsDet.length) {
            detItems.innerHTML = '<tr><td colspan="4" class="vacio">Sin productos en el detalle.</td></tr>'
        } else {
            detItems.innerHTML = itemsDet.map(it => {
                const nombre = unwrapEmbed(it.PRODUCTO)?.N_Producto || `Producto ${it.ID_Producto}`
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

        itemsDetalleActual = itemsDet

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
        cargandoVentas = false
        pintarTabla()
    }

    /* ---------- crear cliente rápido desde la venta ---------- */
    async function crearClienteRapido() {
        const Modal = (await import("../../components/Modal.js")).Modal

        const formHtml = `
            <div style="display:flex; flex-direction:column; gap: var(--space-sm);">
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Nombre *</label>
                    <input class="input" type="text" id="ncli-nombre" placeholder="Nombres" required>
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Apellido paterno *</label>
                    <input class="input" type="text" id="ncli-apellido" placeholder="Apellido paterno" required>
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">N° Documento (DNI)</label>
                    <input class="input" type="text" id="ncli-dni" placeholder="Ej. 12345678" maxlength="8">
                </div>
                <div class="modal-form__campo">
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Celular</label>
                    <input class="input" type="text" id="ncli-celular" placeholder="Ej. 999 888 777">
                </div>
                <p class="modal-nota" style="font-size:0.85rem; color:var(--text-muted); margin-top:var(--space-xs);">
                    Los campos marcados con * son obligatorios.
                </p>
            </div>
        `

        const modal = new Modal({
            title: "Nuevo cliente",
            body: formHtml,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Crear cliente",
                    className: "btn btn--primary",
                    onClick: async (m, boton) => {
                        boton.disabled = true
                        const nombre = document.getElementById("ncli-nombre")?.value?.trim() || ""
                        const apellido = document.getElementById("ncli-apellido")?.value?.trim() || ""
                        const dni = document.getElementById("ncli-dni")?.value?.trim() || null
                        const celular = document.getElementById("ncli-celular")?.value?.trim() || null

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
                            usucre
                        })

                        boton.disabled = false

                        if (!resultado.ok) {
                            console.error("Error al crear cliente:", resultado.error)
                            return notifyError(resultado.error?.message || "No se pudo crear el cliente")
                        }

                        const nuevoCliente = resultado.data
                        notifySuccess("Cliente creado")

                        // Recargar lista de clientes y seleccionar el nuevo
                        const r = await clientService.listarClientes()
                        if (r.ok) {
                            clientes = r.data
                            poblarClientes(selCliente, clientes)
                            for (const opt of selCliente.options) {
                                if (opt.value === "") continue
                                opt.textContent = `#${opt.value} - ${opt.textContent}`
                            }
                            const nuevoOpt = [...selCliente.options].find(
                                o => Number(o.value) === nuevoCliente.ID_Cliente
                            )
                            if (nuevoOpt) selCliente.value = nuevoOpt.value
                        }

                        m.close()
                    }
                }
            ]
        })
        modal.open()
    }

    /* ---------- eventos ---------- */

    try {
        const settled = await Promise.allSettled([
            clientService.listarClientes(),
            userService.listarUsuarios(),
            authService.obtenerSesion()
        ])
        clientesR = settled[0].status === "fulfilled" ? settled[0].value : { ok: false }
        usuariosR = settled[1].status === "fulfilled" ? settled[1].value : { ok: false }
        sesion = settled[2].status === "fulfilled" ? settled[2].value : { ok: false }
        usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"
        clientes = clientesR.ok ? clientesR.data : []
        usuarios = usuariosR.ok ? usuariosR.data : []
    } catch (error) {
        console.error("Error cargando datos auxiliares de ventas:", error)
    }
    try {
        ventasR = await ventaService.listarVentas()
        ventas = ventasR.ok ? (ventasR.data || []) : []
    } catch (error) {
        console.error("Error cargando ventas:", error)
        ventasR = { ok: false, error }
    }
    try {
        await cargarCaja()
    } catch (error) {
        console.warn("No se pudo cargar la caja/métodos de pago, pero se sigue renderizando:", error)
    }
    cargandoVentas = false
    pintarTabla()

    /* Select de clientes: poblarClientes ya formatea como "ID - Nombre" */
    const clientesCargados = poblarClientes(selCliente, clientes)
    if (!clientesCargados && clientesR.ok === false) {
        notifyWarning("No se pudieron cargar los clientes (posible error de permisos/RLS).")
    } else if (!clientesCargados) {
        notifyWarning("No hay clientes registrados en la base de datos.")
    }
    const optsCliente = [...selCliente.options]
    if (inBuscarCliente) {
        inBuscarCliente.addEventListener("input", (e) => {
            const filtro = e.target.value.toLowerCase().trim();
            for (const opt of optsCliente) {
                if (opt.value === "" || opt.value === "0") return;
                const texto = opt.textContent.toLowerCase();
                opt.hidden = !texto.includes(filtro);
                opt.style.display = opt.hidden ? 'none' : 'block';
            }
        })
    }

    /* Pedido a Facturar: contexto de mesa/turno para facturación */
    selPedido.addEventListener("change", async (e) => {
        const id = e.target.value
        if (!id) {
            seleccionarPedido("")
            return
        }
        try {
            await seleccionarPedido(id)
        } catch (error) {
            console.error("Error cargando detalle del pedido:", error)
            pedidoSeleccionado = null
            listaPedido.replaceChildren()
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = `No se pudo cargar el detalle: ${error.message || "error de permisos/RLS"}`
            if (resumenEl) resumenEl.hidden = true
            actualizarResumen()
        }
    })

    if (inBuscarPedido) {
        inBuscarPedido.addEventListener("input", pintarOpcionesPedidos)
    }

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

    /* Tipo de documento: mostrar/ocultar campo DNI/RUC */
    radiosTipoDoc.forEach(r => r.addEventListener("change", cambiarTipoDocumento))

    /* Metodo de pago: habilitar efectivo recibido solo si es efectivo */
    selPago.addEventListener("change", e => {
        actualizarCampoEfectivo(e.target.value)
        calcularVuelto()
    })

    inPagado.addEventListener("input", calcularVuelto)

    btnBuscarDocumento.addEventListener("click", buscarDocumento)

    btnAgregarCliente?.addEventListener("click", async () => {
        if (!clienteExternoPendiente) return
        const { esRUC, doc, nombre, data } = clienteExternoPendiente

        btnAgregarCliente.disabled = true
        btnAgregarCliente.textContent = "Agregando..."

        const datosCliente = {
            nombre: esRUC ? "" : (data.nombres || ""),
            apPaterno: esRUC ? "" : (data.apellidoPaterno || ""),
            apMaterno: esRUC ? "" : (data.apellidoMaterno || ""),
            nDocumento: esRUC ? null : doc,
            email: esRUC ? (data.email || "") : (data.email || ""),
            celular: esRUC ? (data.telefono || "") : "",
            usucre: usucre
        }

        const rCrear = await clientService.crearClienteNatural({
            ...datosCliente,
            nDocumento: esRUC ? null : doc,
            nombre: esRUC ? data.razonSocial || data.nombreComercial || "" : (data.nombres || ""),
            apPaterno: esRUC ? "" : (data.apellidoPaterno || ""),
            apMaterno: esRUC ? "" : (data.apellidoMaterno || "")
        })

        btnAgregarCliente.disabled = false
        btnAgregarCliente.textContent = "Agregar cliente a la base de datos"

        if (!rCrear.ok) {
            if (avisoAgregarMensaje) avisoAgregarMensaje.textContent = rCrear.error?.message || "No se pudo crear el cliente"
            if (avisoAgregarMensaje) avisoAgregarMensaje.style.color = "var(--state-danger)"
            notifyError(rCrear.error?.message || "No se pudo crear el cliente")
            return
        }

        const nuevo = rCrear.data
        clientePorDocumento = {
            ID_Cliente: nuevo.ID_Cliente,
            Tipo_Cliente: esRUC ? "J" : "N",
            PERSONA: esRUC ? null : [{ Nombre: data.nombres || "", Ap_Paterno: data.apellidoPaterno || "", Ap_Materno: data.apellidoMaterno || "", N_Documento: doc }],
            EMPRESA: esRUC ? [{ RUC: doc, Razon_Social: data.razonSocial || "", Nombre_Comercial: data.nombreComercial || "" }] : null
        }
        clienteIdInput.value = nuevo.ID_Cliente
        clienteNombreEl.textContent = esRUC
            ? (data.razonSocial || data.nombreComercial || "")
            : `${data.nombres || ""} ${data.apellidoPaterno || ""}`.trim()
        clienteDocEl.textContent = `${esRUC ? "RUC" : "DNI"}: ${doc}`
        if (avisoDocumento) {
            avisoDocumento.textContent = "Cliente creado y listo para facturar"
            avisoDocumento.style.color = "var(--state-success)"
            avisoDocumento.hidden = false
        }
        if (campoClienteEncontrado) campoClienteEncontrado.hidden = false
        if (avisoAgregarCliente) avisoAgregarCliente.hidden = true
        clienteExternoPendiente = null
        notifySuccess("Cliente creado correctamente")
    })

    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    btnDetCerrar.addEventListener("click", () => {
        detModalEl.hidden = true
        document.body.classList.remove("sin-scroll")
    })
    detModalEl.addEventListener("click", e => { if (e.target === detModalEl) { detModalEl.hidden = true; document.body.classList.remove("sin-scroll") } })

    /* Generar y abrir el PDF del detalle de venta en una nueva pestaña.
       Lee los datos del DOM del modal de detalle (poblados por verDetalle)
       y de itemsDetalleActual. No guarda en Storage, solo abre window.open(). */
    async function generarYAbrirPDF() {
        const { jsPDF } = window.jspdf || {}
        if (!jsPDF) {
            return notifyError("No se pudo cargar la librería de PDF")
        }

        const ventaId = detModalEl.querySelector("#det-venta-id").textContent.replace("#", "").trim()
        const fecha = detModalEl.querySelector("#det-venta-fecha").textContent
        const cliente = detModalEl.querySelector("#det-venta-cliente").textContent
        const documento = detModalEl.querySelector("#det-venta-documento")?.textContent || "-"
        const metodo = detModalEl.querySelector("#det-venta-metodo")?.textContent || "-"
        const total = detModalEl.querySelector("#det-venta-total").textContent
        const subTotal = detModalEl.querySelector("#det-subtotal").textContent
        const igv = detModalEl.querySelector("#det-igv").textContent

        const doc = new jsPDF()

        doc.setFontSize(16)
        doc.text("Comprobante de Venta", 20, 20)
        doc.setFontSize(11)
        doc.text(`Venta #${ventaId}`, 20, 35)
        doc.text(`Fecha: ${fecha}`, 20, 45)
        doc.text(`Cliente: ${cliente}`, 20, 55)
        doc.text(`Documento: ${documento}`, 20, 65)
        doc.text(`Método de pago: ${metodo}`, 20, 75)

        doc.text("Productos:", 20, 90)

        doc.autoTable({
            startY: 98,
            head: [["Producto", "Cantidad", "Precio", "Subtotal"]],
            body: itemsDetalleActual.map(it => [
                unwrapEmbed(it.PRODUCTO)?.N_Producto || `Producto ${it.ID_Producto}`,
                String(it.Cantidad || 0),
                `S/ ${Number(it.Precio || 0).toFixed(2)}`,
                `S/ ${Number(it.Sub_Total || 0).toFixed(2)}`,
            ]),
        })

        const finalY = (doc.lastAutoTable?.finalY || 130) + 15
        doc.text(`Subtotal: ${subTotal}`, 20, finalY)
        doc.text(`IGV (18%): ${igv}`, 20, finalY + 10)
        doc.text(`Total: ${total}`, 20, finalY + 20)

        // Abre el PDF en una pestaña nueva sin guardarlo en BD ni descargarlo
        const pdfBlob = doc.output("blob")
        const pdfUrl = URL.createObjectURL(pdfBlob)
        window.open(pdfUrl, "_blank")
    }

    /* Descargar PDF del detalle de venta */
    const btnDetPDF = detModalEl.querySelector("#ventas-detalle-descargar-pdf")
    if (btnDetPDF) {
        btnDetPDF.addEventListener("click", generarYAbrirPDF)
    }

    /* Si venimos de "Guardar y procesar venta" desde Pedidos,
       abrir el modal de nueva venta con el pedido precargado. */
    if (sessionStorage.getItem("rodilla:pedido_para_venta")) {
        await abrirNuevo()
    }

    return () => {
        window.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

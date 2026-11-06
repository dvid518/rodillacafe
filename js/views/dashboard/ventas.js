import { ventaService } from "../../services/ventaService.js"
import { clientService } from "../../services/clientService.js"
import { dniService } from "../../services/dniService.js"
import { rucService } from "../../services/rucService.js"
import { cajaService } from "../../services/cajaService.js"
import { userService } from "../../services/userService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio, formatearFecha } from "../../utils/format.js"
import { poblarClientes } from "./crud-comun.js"
import { unwrapEmbed } from "../../utils/supabaseHelpers.js"

const ESTADO_VENTA = { P: "Pendiente", C: "Completada", X: "Anulada" }

/* Cliente genérico para boletas simples (sin DNI). ID_Cliente es NOT NULL en VENTA. */
const ID_CLIENTE_CONSUMIDOR_FINAL = 67

export async function ventasController(contenedor) {
    const [ventasR, clientesR, usuariosR, sesion] = await Promise.all([
        ventaService.listarVentas(),
        clientService.listarClientes(),
        userService.listarUsuarios(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let ventas = ventasR.ok ? ventasR.data : []
    let clientes = clientesR.ok ? clientesR.data : []
    let usuarios = usuariosR.ok ? usuariosR.data : []
    let metodosPago = []
    let editandoId = null

    /* Apertura abierta en memoria (para mostrarla en el modal) */
    let aperturaAbierta = null

    const tbodyEl = contenedor.querySelector("#ventas-tbody")
    const modalEl = contenedor.querySelector("#ventas-modal")
    const selCliente = modalEl.querySelector("#ventas-input-cliente")
    const selCajero = modalEl.querySelector("#ventas-input-cajero")
    const selPedido = modalEl.querySelector("#ventas-input-pedido")
    const avisoPedido = modalEl.querySelector("#venta-aviso-pedido")
    const selPago = modalEl.querySelector("#ventas-input-pago")
    const inBuscarCliente = modalEl.querySelector("#ventas-buscar-cliente")
    const listaPedido = modalEl.querySelector("#venta-lista-pedido")
    const avisoSinPedido = modalEl.querySelector("#venta-aviso-sin-pedido")
    const elTotal = modalEl.querySelector("#ventas-total")
    const inPagado = modalEl.querySelector("#ventas-input-pagado")
    const btnGuardar = modalEl.querySelector("#ventas-modal-guardar")
    const btnCancelar = modalEl.querySelector("#ventas-modal-cancelar")
    const btnNuevo = contenedor.querySelector("#ventas-nuevo")
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

    /* Pedido seleccionado (con DETALLE_PEDIDO embebido) */
    let pedidoSeleccionado = null

    /* Cliente resuelto por DNI/RUC (se rellena al buscar) */
    let clientePorDocumento = null

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
        const [rApertura, rPagos] = await Promise.all([
            cajaService.obtenerAperturaAbierta(),
            cajaService.listarMetodosPago(),
        ])
        if (rApertura.ok && rApertura.data) {
            aperturaAbierta = rApertura.data
            const a = aperturaAbierta
            const caja = a.CAJA?.[0]?.N_Caja || "Caja"
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
            selPago.replaceChildren(
                ...metodosPago.map(m => {
                    const o = document.createElement("option")
                    o.value = m.ID_MetodoPago
                    o.textContent = escaparHTML(m.N_MetodoPago || "Pago")
                    return o
                })
            )
        }
    }

    function fechaLegible(iso) {
        return formatearFecha(iso, { dateStyle: "short", timeStyle: "short" }).replace(/, /g, " ")
    }

    /* ---------- tabla de ventas ---------- */

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
                    <td>${escaparHTML(fechaLegible(v.F_Venta))}</td>
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

    /* ---------- detalle del pedido a facturar (solo lectura) ---------- */

    function renderizarDetallePedido(pedido) {
        listaPedido.replaceChildren()
        const lineas = (pedido && pedido.DETALLE_PEDIDO) || []

        if (!lineas.length) {
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = "El pedido seleccionado no tiene productos."
            elTotal.textContent = "S/ 0.00"
            return
        }

        avisoSinPedido.hidden = true

        let subTotal = 0
        for (const d of lineas) {
            const cantidad = Number(d.Cantidad || 0)
            const precio = Number(d.Precio || 0)
            const subtotal = cantidad * precio
            subTotal += subtotal
            const producto = d.PRODUCTO?.[0] || {}
            const nombre = escaparHTML(producto.N_Producto || `Producto ${d.ID_Producto}`)

            const fila = document.createElement("div")
            fila.className = "venta-lista-pedido__fila"
            fila.innerHTML = `
                <span class="venta-lista-pedido__cantidad">${cantidad}</span>
                <span class="venta-lista-pedido__nombre">${nombre}</span>
                <span class="venta-lista-pedido__precio">S/ ${formatearPrecio(precio)}</span>
                <span class="venta-lista-pedido__subtotal">S/ ${formatearPrecio(subtotal)}</span>
            `
            listaPedido.appendChild(fila)
        }

        const igv = Number((subTotal * 0.18).toFixed(2))
        const total = Number((subTotal + igv).toFixed(2))
        elTotal.textContent = `S/ ${formatearPrecio(total)}`
    }

    function seleccionarPedido(idPedido) {
        if (!idPedido) {
            pedidoSeleccionado = null
            listaPedido.replaceChildren()
            avisoSinPedido.hidden = false
            avisoSinPedido.textContent = "Selecciona un pedido para ver sus productos."
            elTotal.textContent = "S/ 0.00"
            return
        }
        const pedidoObj = pedidosPorId.get(Number(idPedido))
        pedidoSeleccionado = pedidoObj || null
        renderizarDetallePedido(pedidoSeleccionado)
    }

    /* Mapa ID_Pedido -> objeto pedido (con DETALLE_PEDIDO embebido) */
    const pedidosPorId = new Map()

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
        selPedido.value = ""
        pedidoSeleccionado = null
        listaPedido.replaceChildren()
        avisoSinPedido.hidden = false
        avisoSinPedido.textContent = "Selecciona un pedido para ver sus productos."
        elTotal.textContent = "S/ 0.00"
        const resumenEl = modalEl.querySelector("#venta-resumen")
        if (resumenEl) resumenEl.hidden = true

        await cargarPedidosPendientes()

        cambiarTipoDocumento()

        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        selPedido.focus()
    }

    async function cargarPedidosPendientes() {
        const r = await ventaService.listarPedidosPendientes()
        selPedido.replaceChildren()
        pedidosPorId.clear()

        if (!r.ok || !r.data.length) {
            const o = document.createElement("option")
            o.value = ""
            o.disabled = true
            o.textContent = "No hay pedidos pendientes"
            selPedido.appendChild(o)
            selPedido.disabled = true
            if (avisoPedido) avisoPedido.hidden = false
            btnGuardar.disabled = true
            console.warn("No hay pedidos pendientes para facturar:", r.ok ? null : r.error)
            return
        }

        selPedido.disabled = false
        if (avisoPedido) avisoPedido.hidden = true
        btnGuardar.disabled = false

        const optVacio = document.createElement("option")
        optVacio.value = ""
        optVacio.textContent = "Selecciona un pedido"
        selPedido.appendChild(optVacio)

        for (const p of r.data) {
            const mesa = unwrapEmbed(p.MESA)?.Numero || null
            const clienteObj = unwrapEmbed(p.CLIENTE)
            const personaObj = clienteObj ? unwrapEmbed(clienteObj.PERSONA) : null

            const nomCliente = personaObj
                ? `${personaObj.Nombre} ${personaObj.Ap_Paterno || ""}`.trim()
                : null

            const partes = [`#${p.ID_Pedido}`]
            if (mesa) partes.push(`Mesa ${mesa}`)
            if (nomCliente) partes.push(`- ${nomCliente}`)
            else partes.push(`- Cliente #${p.ID_Cliente}`)

            const o = document.createElement("option")
            o.value = p.ID_Pedido
            o.textContent = partes.join(" ")
            selPedido.appendChild(o)
            pedidosPorId.set(Number(p.ID_Pedido), p)
        }
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

        // Aviso informativo de Consumidor Final (solo boleta simple)
        const avisoCF = document.getElementById("venta-aviso-consumidor-final")
        if (avisoCF) avisoCF.hidden = !esSimple

        // Si es boleta simple, limpiar cliente del select también
        if (esSimple) {
            selCliente.value = ""
        }
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
                // Para DNI: buscar en CLIENTE por persona. Para RUC: buscar por empresa.
                // Intentamos resolver vía userService.buscarUsuarioPorDNI o listarClientes
                // Aquí usamos un enfoque directo: buscar cliente por documento
                const clientes = await clientService.listarClientes()
                let clienteEncontrado = null
                if (clientes.ok) {
                    clienteEncontrado = (clientes.data || []).find(c => {
                        const p = c.PERSONA?.[0]
                        const e = c.EMPRESA?.[0]
                        if (esRUC && e) return e.RUC === doc
                        if (esDNI && p) return p.N_Documento === doc
                        return false
                    })
                }
                if (!clienteEncontrado) {
                    notifyError("El documento existe en la base de datos pero no tiene cliente asociado")
                    return
                }
                clientePorDocumento = clienteEncontrado
                clienteIdInput.value = clienteEncontrado.ID_Cliente
                clienteNombreEl.textContent = esRUC
                    ? clienteEncontrado.EMPRESA?.[0]?.Razon_Social || "Empresa"
                    : `${clienteEncontrado.PERSONA?.[0]?.Nombre || ""} ${clienteEncontrado.PERSONA?.[0]?.Ap_Paterno || ""}`.trim()
                clienteDocEl.textContent = `${esRUC ? "RUC" : "DNI"}: ${doc}`
                if (avisoDocumento) {
                    avisoDocumento.textContent = "Cliente encontrado en la base de datos"
                    avisoDocumento.style.color = "var(--state-success)"
                }
                if (campoClienteEncontrado) campoClienteEncontrado.hidden = false
                notifySuccess("Cliente encontrado")
            } else {
                // No existe en BD: ofrecer crear desde Factiliza
                const nombre = esRUC
                    ? data.razonSocial || data.nombreComercial || ""
                    : `${data.nombres || ""} ${data.apellidoPaterno || ""} ${data.apellidoMaterno || ""}`.trim()

                const crear = confirm(
                    `El documento ${doc} no está en la base de datos.\n\n${nombre}\n¿Desea agregarlo como cliente?`
                )
                if (!crear) {
                    if (avisoDocumento) {
                        avisoDocumento.textContent = "Documento no registrado"
                        avisoDocumento.style.color = "var(--text-muted)"
                    }
                    return
                }

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

                if (!rCrear.ok) {
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
                }
                if (campoClienteEncontrado) campoClienteEncontrado.hidden = false
                notifySuccess("Cliente creado correctamente")
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

        const totals = renderizarDetallePedido(pedidoSeleccionado) // recalcula el total mostrado
        const tPagado = Number(inPagado.value) || totals.total

        const datos = {
            ID_Cliente: idCliente,
            ID_AperturaCaja: idApertura,
            ID_Pedido: idPedido,
            TipoDocumento: tipoDoc,
            ID_MetodoPago: idPago,
            T_Pagado: tPagado,
            Monto_Recibido: tPagado,
            USUCRE: usucre,
            productos: productosVenta
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
        await cargarCaja()
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

        const cliente = venta.CLIENTE?.[0]
        const persona = cliente?.PERSONA?.[0]
        const nombreCliente = persona
            ? `${persona.Nombre} ${persona.Ap_Paterno || ""}`.trim()
            : (cliente ? `Cliente #${cliente.ID_Cliente}` : "-")

        const fecha = fechaLegible(venta.F_Venta)
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

        if (!itemsDet.length) {
            detItems.innerHTML = '<tr><td colspan="4" class="vacio">Sin productos en el detalle.</td></tr>'
        } else {
            detItems.innerHTML = itemsDet.map(it => {
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

    await cargarCaja()
    pintarTabla()

    /* Select de clientes */
    poblarClientes(selCliente, clientes)
    const optsCliente = [...selCliente.options]
    if (inBuscarCliente) {
        inBuscarCliente.addEventListener("input", () => {
            const q = inBuscarCliente.value.toLowerCase()
            for (const opt of optsCliente) {
                if (opt.value === "") {
                    opt.hidden = false
                    continue
                }
                opt.hidden = !opt.textContent.toLowerCase().includes(q)
            }
        })
    }

    /* Select de cajeros: solo ADMINISTRADOR / CAJERO */
    if (selCajero) {
        const cajeros = (usuarios || []).filter(u =>
            (u.USUARIO_ROL || []).some(r => {
                const rol = r.ROL?.[0]?.N_Rol
                return rol === "ADMINISTRADOR" || rol === "CAJERO"
            })
        )
        selCajero.replaceChildren(
            ...cajeros.map(u => {
                const o = document.createElement("option")
                o.value = u.ID_Usuario
                o.textContent = escaparHTML(u.Logeo || `Usuario #${u.ID_Usuario}`)
                return o
            })
        )
    }

    /* Pedido a Facturar: contexto de mesa/turno para facturación */
    selPedido.addEventListener("change", e => {
        seleccionarPedido(e.target.value)
    })

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
    btnNuevoCliente.addEventListener("click", crearClienteRapido)

    /* Tipo de documento: mostrar/ocultar campo DNI/RUC */
    radiosTipoDoc.forEach(r => r.addEventListener("change", cambiarTipoDocumento))

    btnBuscarDocumento.addEventListener("click", buscarDocumento)

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

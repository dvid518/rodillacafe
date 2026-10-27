import { clientService } from "../../services/clientService.js"
import { orderService } from "../../services/orderService.js"
import { ventaService } from "../../services/ventaService.js"
import { inventarioService } from "../../services/inventarioService.js"
import { cajaService } from "../../services/cajaService.js"
import { reporteService } from "../../services/reporteService.js"
import { authService } from "../../services/authService.js"
import { notifySuccess, notifyError } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"

export async function simulacionController(contenedor) {
    const btnEjecutar = contenedor.querySelector("#sim-ejecutar")
    const btnLimpiar = contenedor.querySelector("#sim-limpiar")
    const selProductos = contenedor.querySelector("#sim-productos")
    const pasosEl = contenedor.querySelector("#sim-pasos")
    const resumenEl = contenedor.querySelector("#sim-resumen")
    const tbodyResumen = contenedor.querySelector("#sim-resumen-tbody")

    const estado = contenedor.querySelector("#sim-estado")

    let sesion = null
    let usucre = "WEB"

    /* ---------- helpers de UI ---------- */

    function limpiar() {
        pasosEl.innerHTML = ""
        resumenEl.style.display = "none"
        tbodyResumen.innerHTML = ""
        btnEjecutar.disabled = false
        btnEjecutar.textContent = "Simular proceso completo"
    }

    function paso(texto, tipo = "info") {
        const p = document.createElement("p")
        p.style.margin = "4px 0"
        p.style.paddingLeft = "var(--space-sm)"
        p.style.borderLeft = "3px solid "
        if (tipo === "ok") {
            p.style.borderLeftColor = "var(--state-success)"
            p.style.color = "var(--text)"
            p.innerHTML = `<strong style="color: var(--state-success)">&#10003;</strong> ${escaparHTML(texto)}`
        } else if (tipo === "error") {
            p.style.borderLeftColor = "var(--state-danger)"
            p.style.color = "var(--text)"
            p.innerHTML = `<strong style="color: var(--state-danger)">&#10007;</strong> ${escaparHTML(texto)}`
        } else {
            p.style.borderLeftColor = "var(--accent)"
            p.style.color = "var(--text-muted)"
            p.innerHTML = `<span style="color: var(--text-muted)">&#9679;</span> ${escaparHTML(texto)}`
        }
        pasosEl.appendChild(p)
        estado.scrollTop = estado.scrollHeight
    }

    /* ---------- inicializacion ---------- */

    async function init() {
        const s = await authService.obtenerSesion()
        if (s.ok && s.data) {
            sesion = s.data
            usucre = (sesion.Logeo || sesion.email || "WEB").substring(0, 30)
        }
    }

    /* ---------- simulacion end-to-end ---------- */

    async function ejecutar() {
        limpiar()
        const nProductos = Number(selProductos.value)
        const pasos = []
        const resumen = []

        /* Paso 1: obtener productos con stock */
        paso("1/7 — Buscando productos con stock...", "info")
        const rProductos = await inventarioService.listarProductos()
        if (!rProductos.ok || !rProductos.data.length) {
            paso("No se encontraron productos con stock controlado.", "error")
            btnEjecutar.disabled = false
            return
        }
        const disponibles = rProductos.data.filter(p => Number(p.Stock_Actual || 0) > 0).slice(0, nProductos)
        if (disponibles.length < 1) {
            paso("No hay productos con stock disponible para simular.", "error")
            btnEjecutar.disabled = false
            return
        }
        paso(`Productos seleccionados: ${disponibles.map(p => p.N_Producto).join(", ")}`, "ok")
        resumen.push(["Productos", disponibles.length, disponibles.map(p => p.N_Producto).join(", ")])

        /* Paso 2: obtener un cliente existente */
        paso("2/7 — Buscando cliente...", "info")
        const rClientes = await clientService.listarClientes()
        if (!rClientes.ok || !rClientes.data.length) {
            paso("No hay clientes registrados. Crea un cliente primero.", "error")
            btnEjecutar.disabled = false
            return
        }
        const cliente = rClientes.data[0]
        const p = cliente.PERSONA?.[0]
        const e = cliente.EMPRESA?.[0]
        const nombreCliente = p ? `${p.Nombre} ${p.Ap_Paterno || ""}`.trim() : (e ? e.Razon_Social : `Cliente #${cliente.ID_Cliente}`)
        paso(`Cliente: ${escaparHTML(nombreCliente)} (#${cliente.ID_Cliente})`, "ok")
        resumen.push(["Cliente", cliente.ID_Cliente, nombreCliente])

        /* Paso 3: tipo de atencion */
        paso("3/7 — Resolviendo tipo de atencion...", "info")
        const rTipos = await orderService.listarTiposAtencion()
        if (!rTipos.ok || !rTipos.data.length) {
            paso("No hay tipos de atencion configurados.", "error")
            btnEjecutar.disabled = false
            return
        }
        const tipo = rTipos.data.find(t => String(t.N_TipoAtencion).toUpperCase().includes("PARA LLEVAR")) || rTipos.data[0]
        paso(`Tipo de atencion: ${tipo.N_TipoAtencion} (#${tipo.ID_TipoAtencion})`, "ok")
        resumen.push(["Tipo atencion", tipo.ID_TipoAtencion, tipo.N_TipoAtencion])

        /* Paso 4: apertura de caja abierta */
        paso("4/7 — Verificando caja abierta...", "info")
        const rApertura = await cajaService.obtenerAperturaAbierta()
        if (!rApertura.ok || !rApertura.data) {
            paso("No hay una caja abierta. Abre una caja antes de simular.", "error")
            btnEjecutar.disabled = false
            return
        }
        const apertura = rApertura.data
        paso(`Caja abierta: turno ${apertura.Numero_Turno} (#${apertura.ID_AperturaCaja})`, "ok")
        resumen.push(["Apertura caja", apertura.ID_AperturaCaja, `Turno ${apertura.Numero_Turno}`])

        /* Paso 5: metodo de pago efectivo */
        paso("5/7 — Buscando metodo de pago (efectivo)...", "info")
        const rMetodos = await cajaService.listarMetodosPago()
        if (!rMetodos.ok || !rMetodos.data.length) {
            paso("No hay metodos de pago configurados.", "error")
            btnEjecutar.disabled = false
            return
        }
        const metodoPago = rMetodos.data.find(m => String(m.Es_Efectivo) === "1") || rMetodos.data[0]
        paso(`Metodo de pago: ${metodoPago.N_MetodoPago} (#${metodoPago.ID_MetodoPago})`, "ok")
        resumen.push(["Metodo pago", metodoPago.ID_MetodoPago, metodoPago.N_MetodoPago])

        /* Paso 6: crear pedido */
        paso("6/7 — Creando pedido...", "info")
        const items = disponibles.map(prod => ({
            ID_Producto: prod.ID_Producto,
            Cantidad: 1,
            Precio: Number(prod.Precio || 0)
        }))
        const rPedido = await orderService.crearManual({
            ID_Cliente: cliente.ID_Cliente,
            ID_TipoAtencion: tipo.ID_TipoAtencion,
            N_Comensales: 1,
            Observacion: "Simulacion Avance 3",
            USUCRE: usucre,
            items
        })
        if (!rPedido.ok) {
            paso(`Error creando pedido: ${rPedido.error?.message || "desconocido"}`, "error")
            btnEjecutar.disabled = false
            return
        }
        const pedido = rPedido.data
        paso(`Pedido creado #${pedido.ID_Pedido} (Total S/ ${Number(pedido.Total || 0).toFixed(2)})`, "ok")
        resumen.push(["Pedido", pedido.ID_Pedido, `Total S/ ${Number(pedido.Total || 0).toFixed(2)}`])

        /* Paso 7: crear venta (facturar) */
        paso("7/7 — Facturando venta...", "info")
        const totalVenta = Number(pedido.Total || 0)
        const rVenta = await ventaService.crearVenta({
            ID_Cliente: cliente.ID_Cliente,
            ID_AperturaCaja: apertura.ID_AperturaCaja,
            TipoDocumento: "03",
            ID_MetodoPago: metodoPago.ID_MetodoPago,
            T_Pagado: totalVenta,
            productos: items,
            USUCRE: usucre
        })
        if (!rVenta.ok) {
            paso(`Error creando venta: ${rVenta.error?.message || "desconocido"}`, "error")
            btnEjecutar.disabled = false
            return
        }
        const venta = rVenta.data
        paso(`Venta facturada #${venta.ID_Venta} (Total S/ ${Number(venta.Total || 0).toFixed(2)})`, "ok")
        resumen.push(["Venta", venta.ID_Venta, `Total S/ ${Number(venta.Total || 0).toFixed(2)}`])

        /* Paso 8: registrar movimiento de caja */
        paso("Registrando movimiento de caja...", "info")
        const rConceptos = await cajaService.listarConceptos()
        if (rConceptos.ok && rConceptos.data.length) {
            const conceptoVenta = rConceptos.data.find(c =>
                String(c.N_Concepto).toUpperCase().includes("VENTA")
            ) || rConceptos.data[0]
            const rMovimiento = await cajaService.registrarMovimiento({
                ID_AperturaCaja: apertura.ID_AperturaCaja,
                ID_Concepto: conceptoVenta.ID_Concepto,
                ID_MetodoPago: metodoPago.ID_MetodoPago,
                Monto: totalVenta,
                Descripcion: `Venta #${venta.ID_Venta} - Simulacion`,
                Documento: null
            })
            if (rMovimiento.ok) {
                paso(`Movimiento de caja registrado (concepto: ${conceptoVenta.N_Concepto})`, "ok")
            } else {
                paso(`Movimiento de caja fallo: ${rMovimiento.error?.message || "desconocido"}`, "error")
            }
        } else {
            paso("No se encontraron conceptos de caja para el movimiento.", "error")
        }

        /* Paso 9: verificar reporte (listar ventas recientes) */
        paso("Verificando reporte de ventas...", "info")
        const hoy = new Date()
        const hace30 = new Date(hoy)
        hace30.setDate(hoy.getDate() - 30)
        const desde = hace30.toISOString().split("T")[0]
        const hasta = hoy.toISOString().split("T")[0]
        const rVentas = await reporteService.ventasPorDia(desde, hasta, "E")
        if (rVentas.ok && rVentas.data.length) {
            const aparece = rVentas.data.some(d => {
                const f = String(d.fecha || "").split("T")[0]
                return f === hasta
            })
            paso(aparece ? "La venta aparece en el reporte del dia." : "La venta no aparece aun en el reporte (puede requerir recarga).", aparece ? "ok" : "info")
        } else {
            paso("No se pudo consultar el reporte de ventas.", "info")
        }

        /* Resumen final */
        btnEjecutar.disabled = false
        btnEjecutar.textContent = "Simulacion completada"
        resumenEl.style.display = "block"
        tbodyResumen.innerHTML = resumen.map(r => `
            <tr>
                <td>${escaparHTML(r[0])}</td>
                <td>${escaparHTML(String(r[1]))}</td>
                <td>${escaparHTML(String(r[2]))}</td>
            </tr>
        `).join("")
        notifySuccess("Simulacion de proceso completo finalizada")
    }

    /* ---------- eventos ---------- */

    await init()

    btnEjecutar.addEventListener("click", () => {
        btnEjecutar.disabled = true
        btnEjecutar.textContent = "Ejecutando..."
        ejecutar()
    })

    btnLimpiar.addEventListener("click", limpiar)

    return () => {}
}

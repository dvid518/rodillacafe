import { reporteService } from "../../services/reporteService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio } from "../../utils/format.js"

/* Estado de nivel de módulo para poder usarlo en las exportaciones sin
   volver a consultar Supabase. */
let graficoDias = null
let kpisData = null
let productosData = []
let metodosData = []

export async function reportesController(contenedor) {
    const [sesion] = await Promise.all([
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    const kpisEl = contenedor.querySelector("#reportes-kpis")
    const tbodyProductos = contenedor.querySelector("#reportes-productos-tbody")
    const tbodyMetodos = contenedor.querySelector("#reportes-metodos-tbody")
    const inputDesde = contenedor.querySelector("#reportes-fecha-desde")
    const inputHasta = contenedor.querySelector("#reportes-fecha-hasta")
    const selectEstado = contenedor.querySelector("#reportes-filtro-estado")
    const btnAplicar = contenedor.querySelector("#reportes-aplicar")

    /* ---------- fechas por defecto: últimos 30 días ---------- */

    const hoy = new Date()
    const hace30Dias = new Date(hoy)
    hace30Dias.setDate(hoy.getDate() - 30)

    const formatoISO = d => d.toISOString().split("T")[0]

    inputDesde.value = formatoISO(hace30Dias)
    inputHasta.value = formatoISO(hoy)

    /* ---------- carga ---------- */

    async function cargar() {
        const desde = inputDesde.value
        const hasta = inputHasta.value
        const estado = selectEstado ? selectEstado.value : "E"

        if (!desde || !hasta) return

        const [rKpis, rProductos, rMetodos, rDias] = await Promise.all([
            reporteService.kpis(desde, hasta, estado),
            reporteService.productosMasVendidos(desde, hasta, 10, estado),
            reporteService.ventasPorMetodoPago(desde, hasta, estado),
            reporteService.ventasPorDia(desde, hasta, estado)
        ])

        if (!rKpis.ok) {
            console.error("Error cargando KPIs:", rKpis.error)
            return notifyError("No se pudieron cargar los KPIs")
        }
        if (!rProductos.ok) {
            console.error("Error cargando productos:", rProductos.error)
            return notifyError("No se pudieron cargar los productos más vendidos")
        }
        if (!rMetodos.ok) {
            console.error("Error cargando métodos:", rMetodos.error)
            return notifyError("No se pudieron cargar los métodos de pago")
        }

        kpisData = rKpis.data
        productosData = rProductos.data
        metodosData = rMetodos.data

        pintarKPIs(kpisData)
        pintarProductos(productosData)
        pintarMetodos(metodosData)

        const diasData = rDias.ok ? rDias.data : []
        renderGraficoDias(diasData)
    }

    /* ---------- KPIs ---------- */

    function pintarKPIs(d) {
        const total = Number(d.total || 0)
        const cantidad = Number(d.cantidad || 0)
        const ticket = Number(d.ticketPromedio || 0)

        kpisEl.innerHTML = `
            <div class="caja-metrica">
                <div class="caja-metrica__titulo">Ventas totales</div>
                <div class="caja-metrica__valor caja-metrica__valor--positivo">S/ ${formatearPrecio(total)}</div>
            </div>
            <div class="caja-metrica">
                <div class="caja-metrica__titulo">Número de ventas</div>
                <div class="caja-metrica__valor">${cantidad}</div>
            </div>
            <div class="caja-metrica">
                <div class="caja-metrica__titulo">Ticket promedio</div>
                <div class="caja-metrica__valor">S/ ${formatearPrecio(ticket)}</div>
            </div>
            <div class="caja-metrica">
                <div class="caja-metrica__titulo">Período</div>
                <div class="caja-metrica__valor">${escaparHTML(inputDesde.value)} al ${escaparHTML(inputHasta.value)}</div>
            </div>
        `
    }

    /* ---------- productos más vendidos ---------- */

    function pintarProductos(data) {
        if (!data.length) {
            tbodyProductos.innerHTML = '<tr class="fila-vacia"><td colspan="3">Sin ventas en el período.</td></tr>'
            return
        }

        tbodyProductos.innerHTML = data.map(p => `
            <tr>
                <td>${escaparHTML(p.nombre || "-")}</td>
                <td>${Number(p.cantidad || 0)}</td>
                <td>S/ ${formatearPrecio(p.total || 0)}</td>
            </tr>
        `).join("")
    }

    /* ---------- ventas por método de pago ---------- */

    function pintarMetodos(data) {
        if (!data.length) {
            tbodyMetodos.innerHTML = '<tr class="fila-vacia"><td colspan="3">Sin ventas en el período.</td></tr>'
            return
        }

        tbodyMetodos.innerHTML = data.map(m => `
            <tr>
                <td>${escaparHTML(m.metodo || "-")}</td>
                <td>${Number(m.cantidad || 0)}</td>
                <td>S/ ${formatearPrecio(m.total || 0)}</td>
            </tr>
        `).join("")
    }

    /* ---------- gráfico de ventas por día ---------- */

    function renderGraficoDias(data) {
        const canvas = document.getElementById("reportes-grafico-dias")
        if (!canvas) return

        if (graficoDias) graficoDias.destroy()

        graficoDias = new window.Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: data.map(d => d.fecha),
                datasets: [{
                    label: "Ventas (S/)",
                    data: data.map(d => Number(d.total || 0)),
                    backgroundColor: "#a82b13"
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        })
    }

    /* ---------- exportación a PDF ---------- */

    async function exportarPDF() {
        const { jsPDF } = window.jspdf
        if (!jsPDF) {
            return notifyError("jsPDF no está disponible")
        }

        const doc = new jsPDF()

        doc.text("Reporte de Ventas - Rodilla", 14, 15)

        // KPIs
        const total = Number(kpisData?.total || 0)
        const cantidad = Number(kpisData?.cantidad || 0)
        const ticket = Number(kpisData?.ticketPromedio || 0)

        doc.text(`Total vendido: S/ ${total.toFixed(2)}`, 14, 25)
        doc.text(`Cantidad de ventas: ${cantidad}`, 14, 32)
        doc.text(`Ticket promedio: S/ ${ticket.toFixed(2)}`, 14, 39)

        // Productos más vendidos
        doc.text("Productos más vendidos", 14, 50)
        doc.autoTable({
            startY: 55,
            head: [["Producto", "Cantidad", "Total"]],
            body: productosData.map(p => [p.nombre || "-", Number(p.cantidad || 0), `S/ ${Number(p.total || 0).toFixed(2)}`])
        })

        // Ventas por método
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [["Método", "Operaciones", "Total"]],
            body: metodosData.map(m => [m.metodo || "-", Number(m.cantidad || 0), `S/ ${Number(m.total || 0).toFixed(2)}`])
        })

        doc.save("reporte_ventas.pdf")
    }

    /* ---------- exportación a Excel ---------- */

    async function exportarExcel() {
        const XLSX = window.XLSX
        if (!XLSX) {
            return notifyError("SheetJS (XLSX) no está disponible")
        }

        const wb = XLSX.utils.book_new()

        // Hoja 1: KPIs
        const wsKpis = XLSX.utils.aoa_to_sheet([
            ["Métrica", "Valor"],
            ["Total vendido", Number(kpisData?.total || 0)],
            ["Cantidad de ventas", Number(kpisData?.cantidad || 0)],
            ["Ticket promedio", Number(kpisData?.ticketPromedio || 0)]
        ])
        XLSX.utils.book_append_sheet(wb, wsKpis, "KPIs")

        // Hoja 2: Productos
        const wsProductos = XLSX.utils.aoa_to_sheet([
            ["Producto", "Cantidad", "Total"],
            ...productosData.map(p => [p.nombre || "-", Number(p.cantidad || 0), Number(p.total || 0)])
        ])
        XLSX.utils.book_append_sheet(wb, wsProductos, "Productos")

        // Hoja 3: Métodos
        const wsMetodos = XLSX.utils.aoa_to_sheet([
            ["Método", "Operaciones", "Total"],
            ...metodosData.map(m => [m.metodo || "-", Number(m.cantidad || 0), Number(m.total || 0)])
        ])
        XLSX.utils.book_append_sheet(wb, wsMetodos, "Métodos")

        XLSX.writeFile(wb, "reporte_ventas.xlsx")
    }

    /* ---------- eventos ---------- */

    btnAplicar.addEventListener("click", cargar)

    const btnPDF = document.getElementById("reportes-exportar-pdf")
    const btnExcel = document.getElementById("reportes-exportar-excel")
    if (btnPDF) btnPDF.addEventListener("click", exportarPDF)
    if (btnExcel) btnExcel.addEventListener("click", exportarExcel)

    await cargar()

    return () => {}
}

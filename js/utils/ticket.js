/* ==========================================================================
   TICKET TÉRMICO 80 mm — Rodilla
   --------------------------------------------------------------------------
   Genera un PDF de ticket de impresión térmica (ancho 80 mm, altura
   dinámica) para una venta ya registrada.
   Reutiliza jsPDF (ya cargada por CDN en dashboard.html).
   ========================================================================== */

import { formatearPrecio } from "./format.js"

const ANCHO_MM = 80
const MARGEN_MM = 5
const ALTO_LINEA_MM = 5
const MAX_CARACTERES_NOMBRE = 42

/**
 * Genera un ticket térmico de 80 mm en PDF.
 *
 * @param {object} datos
 * @param {string} datos.ventaId - ID de la venta (ej. "123")
 * @param {string} datos.fecha - Fecha y hora legible
 * @param {string} datos.cliente - Nombre del cliente o "Consumidor Final"
 * @param {string} datos.documento - Tipo de documento (Boleta/Factura) o "-"
 * @param {string} datos.metodoPago - Método de pago
 * @param {string} datos.total - Total formateado (ej. "15.00")
 * @param {string} datos.subTotal - Subtotal formateado
 * @param {string} datos.igv - IGV formateado
 * @param {string} [datos.descuento] - Descuento formateado (opcional)
 * @param {string} [datos.efectivoRecibido] - Efectivo recibido o "-"
 * @param {string} [datos.vuelto] - Vuelto o "-"
 * @param {Array} datos.items - [{ nombre, cantidad, precio, subtotal }]
 * @returns {Promise<Blob>} Blob del PDF
 */
export async function generarTicketTermico(datos) {
  const { jsPDF } = window.jspdf || {}
  if (!jsPDF) {
    throw new Error("jsPDF no está disponible")
  }

  const altoTotal = altoTicket(datos)
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: [ANCHO_MM, altoTotal],
  })

  doc.setFont("helvetica")
  let y = MARGEN_MM

  /* ---------- Encabezado ---------- */
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text("Rodilla", ANCHO_MM / 2, y, { align: "center" })
  y += ALTO_LINEA_MM

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Cafetería de especialidad", ANCHO_MM / 2, y, { align: "center" })
  y += ALTO_LINEA_MM * 1.5

  doc.setFontSize(7)
  doc.text("Ticket de venta", ANCHO_MM / 2, y, { align: "center" })
  y += ALTO_LINEA_MM

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGEN_MM, y, ANCHO_MM - MARGEN_MM, y)
  y += ALTO_LINEA_MM

  /* ---------- Datos de la venta ---------- */
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text(`Venta #${datos.ventaId}`, MARGEN_MM, y)
  y += ALTO_LINEA_MM

  doc.setFont("helvetica", "normal")
  doc.text(`Fecha: ${datos.fecha}`, MARGEN_MM, y)
  y += ALTO_LINEA_MM

  doc.text(`Cliente: ${datos.cliente}`, MARGEN_MM, y)
  y += ALTO_LINEA_MM

  if (datos.documento && datos.documento !== "-") {
    doc.text(`Documento: ${datos.documento}`, MARGEN_MM, y)
    y += ALTO_LINEA_MM
  }

  doc.text(`Pago: ${datos.metodoPago}`, MARGEN_MM, y)
  y += ALTO_LINEA_MM

  doc.line(MARGEN_MM, y, ANCHO_MM - MARGEN_MM, y)
  y += ALTO_LINEA_MM

  /* ---------- Tabla de productos ---------- */
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("Producto", MARGEN_MM, y)
  doc.text("Cant", ANCHO_MM - MARGEN_MM - 14, y, { align: "right" })
  doc.text("Precio", ANCHO_MM - MARGEN_MM - 7, y, { align: "right" })
  y += ALTO_LINEA_MM

  doc.setFont("helvetica", "normal")
  for (const item of datos.items) {
    const nombre = item.nombre || `Producto ${item.id || "-"}`
    const lineas = dividirTexto(nombre, MAX_CARACTERES_NOMBRE)
    doc.text(lineas[0], MARGEN_MM, y)
    doc.text(String(item.cantidad || 0), ANCHO_MM - MARGEN_MM - 14, y, { align: "right" })
    doc.text(formatearPrecio(item.precio), ANCHO_MM - MARGEN_MM - 7, y, { align: "right" })
    y += ALTO_LINEA_MM
    for (let i = 1; i < lineas.length; i++) {
      doc.text(lineas[i], MARGEN_MM, y)
      y += ALTO_LINEA_MM
    }
    doc.text(formatearPrecio(item.subtotal), ANCHO_MM - MARGEN_MM - 7, y, { align: "right" })
    y += ALTO_LINEA_MM
  }

  doc.line(MARGEN_MM, y, ANCHO_MM - MARGEN_MM, y)
  y += ALTO_LINEA_MM

  /* ---------- Totales ---------- */
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("Subtotal:", MARGEN_MM, y)
  doc.text(formatearPrecio(datos.subTotal), ANCHO_MM - MARGEN_MM, y, { align: "right" })
  y += ALTO_LINEA_MM

  if (datos.descuento && Number(datos.descuento) > 0) {
    doc.setFont("helvetica", "normal")
    doc.text("Descuento:", MARGEN_MM, y)
    doc.text(`-${formatearPrecio(datos.descuento)}`, ANCHO_MM - MARGEN_MM, y, { align: "right" })
    y += ALTO_LINEA_MM
  }

  doc.text("IGV (18%):", MARGEN_MM, y)
  doc.text(formatearPrecio(datos.igv), ANCHO_MM - MARGEN_MM, y, { align: "right" })
  y += ALTO_LINEA_MM

  doc.setFont("helvetica", "bold")
  doc.text("TOTAL:", MARGEN_MM, y)
  doc.text(formatearPrecio(datos.total), ANCHO_MM - MARGEN_MM, y, { align: "right" })
  y += ALTO_LINEA_MM * 1.5

  if (datos.efectivoRecibido && datos.efectivoRecibido !== "-") {
    doc.setFont("helvetica", "normal")
    doc.text("Efectivo:", MARGEN_MM, y)
    doc.text(formatearPrecio(datos.efectivoRecibido), ANCHO_MM - MARGEN_MM, y, { align: "right" })
    y += ALTO_LINEA_MM

    doc.text("Vuelto:", MARGEN_MM, y)
    doc.text(formatearPrecio(datos.vuelto), ANCHO_MM - MARGEN_MM, y, { align: "right" })
    y += ALTO_LINEA_MM * 1.5
  }

  /* ---------- Pie ---------- */
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text("Gracias por su visita", ANCHO_MM / 2, y, { align: "center" })
  y += ALTO_LINEA_MM
  doc.text("Vuelva pronto", ANCHO_MM / 2, y, { align: "center" })

  return doc.output("blob")
}

/**
 * Alto real del ticket en mm. Suma las líneas que ocupa cada bloque, incluidos
 * los saltos de nombres largos: el alto fijo anterior (42 + ítems + 48) se
 * quedaba corto incluso con un solo producto.
 * @param {object} datos
 * @returns {number}
 */
function altoTicket(datos) {
  const items = Array.isArray(datos.items) ? datos.items : []

  const lineasItems = items.reduce((total, item) => {
    const nombre = item.nombre || `Producto ${item.id || "-"}`
    return total + dividirTexto(nombre, MAX_CARACTERES_NOMBRE).length + 1
  }, 0)

  const lineasDocumento = datos.documento && datos.documento !== "-" ? 1 : 0
  const lineasDescuento = datos.descuento && Number(datos.descuento) > 0 ? 1 : 0
  const lineasEfectivo = datos.efectivoRecibido && datos.efectivoRecibido !== "-" ? 3.5 : 0

  // cabecera 4.5 + datos 5 + documento + cabecera tabla 1 + ítems +
  // cierre 2 + totales 3 + descuento + espacio 1.5 + efectivo + pie 2
  const lineas = 4.5 + 5 + lineasDocumento + 1 + lineasItems + 2 + 3 + lineasDescuento + 1.5 + lineasEfectivo + 2

  return (MARGEN_MM * 2) + (lineas * ALTO_LINEA_MM)
}

/**
 * Divide un texto en líneas de máximo maxCaracteres caracteres.
 * @param {string} texto
 * @param {number} maxCaracteres
 * @returns {string[]}
 */
function dividirTexto(texto, maxCaracteres) {
  const palabras = String(texto).split(" ")
  const lineas = []
  let lineaActual = ""

  for (const palabra of palabras) {
    const prueba = lineaActual ? `${lineaActual} ${palabra}` : palabra
    if (prueba.length <= maxCaracteres) {
      lineaActual = prueba
    } else {
      if (lineaActual) lineas.push(lineaActual)
      lineaActual = palabra
    }
  }
  if (lineaActual) lineas.push(lineaActual)
  return lineas.length ? lineas : [""]
}

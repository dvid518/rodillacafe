import { reservationService } from "../../services/reservationService.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import { ESTADO_RESERVA, badge } from "./crud-comun.js"
import { tablaSimple, botonDetalle } from "./mis-comun.js"

const CELDAS = 6

function formatearHora(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export async function misReservasController(contenedor) {
    return tablaSimple({
        contenedor,
        tbody: "#mis-reservas-tbody",
        celdas: CELDAS,
        cargar: () => reservationService.listarMisReservas(),
        que: "tus reservas",
        vacio: "Todavía no tienes ninguna reserva",
        filas: (reservas, boton) => reservas.map((r, i) => {
            const obs = r.Observacion?.trim()
            return `
            <tr>
                <td>${r.ID_Reserva}</td>
                <td>${escaparHTML(formatearFecha(r.F_Reserva, { dateStyle: "medium" }))}</td>
                <td>${escaparHTML(formatearHora(r.F_Reserva))}</td>
                <td>${r.N_Comensales ?? "—"}</td>
                <td>${badge(ESTADO_RESERVA, r.Situacion)}</td>
                <td class="celda-obs">${obs ? boton(i, `Ver observación de la reserva ${r.ID_Reserva}`, 1) : "—"}</td>
            </tr>
        `
        }).join(""),
        detalle: r => r.Observacion?.trim()
            ? `<p>${escaparHTML(r.Observacion)}</p>`
            : '<p class="vacio">Esta reserva no tiene observación</p>',
    })
}

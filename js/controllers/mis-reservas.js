import "./../session/guard.js"
import { reservationService } from "../services/reservationService.js"

const LABEL_ESTADO = {
    P: "Pendiente",
    A: "Aprobado",
    C: "Cancelado"
}

function formatearFecha(iso) {
    if (!iso) return "-"
    const fecha = new Date(iso)
    return fecha.toLocaleString("es-PE", { dateStyle: "medium" })
}

function formatearHora(iso) {
    if (!iso) return "-"
    const fecha = new Date(iso)
    return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
}

function crearFila(reserva) {
    return `
        <tr>
            <td>${reserva.ID_Reserva}</td>
            <td>${formatearFecha(reserva.F_Reserva)}</td>
            <td>${formatearHora(reserva.F_Reserva)}</td>
            <td>${reserva.N_Comensales}</td>
            <td>${LABEL_ESTADO[reserva.Situacion] || reserva.Situacion}</td>
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("reservas-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(reserva => crearFila(reserva)).join("")
}

async function iniciarPanel() {
    try {
        const resultado = await reservationService.listarMisReservas()
        if (!resultado.ok) {
            console.error("Error al cargar reservas:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar reservas:", error)
    }
}

iniciarPanel()
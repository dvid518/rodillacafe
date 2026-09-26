import { ReservationAdapter } from "../adapters/ReservationAdapter.js"

async function crearReserva(datos) {
    const resultado = await ReservationAdapter.crear(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarMisReservas() {
    return ReservationAdapter.listarMisReservas()
}

async function listarTodas() {
    return ReservationAdapter.listarTodas()
}

async function actualizarEstado(id, situacion) {
    return ReservationAdapter.actualizarEstado(id, situacion)
}

async function eliminarReserva(id) {
    return ReservationAdapter.eliminar(id)
}

export const reservationService = { crearReserva, listarMisReservas, listarTodas, actualizarEstado, eliminarReserva }
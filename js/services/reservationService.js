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

async function crearReservaManual(datos) {
    const resultado = await ReservationAdapter.crearManual(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function actualizarReserva(id, datos) {
    const resultado = await ReservationAdapter.actualizar(id, datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: null }
}

export const reservationService = {
    crearReserva,
    crearReservaManual,
    listarMisReservas,
    listarTodas,
    actualizarReserva,
    actualizarEstado,
    eliminarReserva,
}
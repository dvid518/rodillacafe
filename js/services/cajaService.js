import { CajaAdapter } from "../adapters/CajaAdapter.js"

async function listarCajas() {
    const resultado = await CajaAdapter.listarCajas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function obtenerAperturaAbierta() {
    const resultado = await CajaAdapter.obtenerAperturaAbierta()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarAperturasCerradas() {
    const resultado = await CajaAdapter.listarAperturasCerradas()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function aperturarCaja(idCaja, montoInicial) {
    const resultado = await CajaAdapter.aperturarCaja(idCaja, montoInicial)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarMovimientos(idApertura) {
    const resultado = await CajaAdapter.listarMovimientos(idApertura)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarConceptos() {
    const resultado = await CajaAdapter.listarConceptos()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function listarMetodosPago() {
    const resultado = await CajaAdapter.listarMetodosPago()
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function registrarMovimiento(datos) {
    const resultado = await CajaAdapter.registrarMovimiento(datos)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

async function cerrarCaja(idApertura, montoDeclarado, observacion) {
    const resultado = await CajaAdapter.cerrarCaja(idApertura, montoDeclarado, observacion)
    if (!resultado.ok) return { ok: false, error: resultado.error }
    return { ok: true, data: resultado.data }
}

export const cajaService = {
    listarCajas,
    obtenerAperturaAbierta,
    listarAperturasCerradas,
    aperturarCaja,
    listarMovimientos,
    listarConceptos,
    listarMetodosPago,
    registrarMovimiento,
    cerrarCaja
}

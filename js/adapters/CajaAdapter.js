import { supabase } from "../lib/supabaseClient.js"

const APERTURA_SELECT = `
    ID_AperturaCaja, Numero_Turno, F_Apertura, F_Cierre,
    Monto_Inicial, Total_Ingresos, Total_Egresos,
    Monto_Sistema, Monto_Declarado, Diferencia, Situacion,
    Observacion,
    CAJA ( ID_Caja, N_Caja ),
    USUARIO!FK_APERCAJA_USUARIO ( ID_Usuario, Logeo )
`

const MOVIMIENTO_SELECT = `
    ID_MovimientoCaja, F_Movimiento, Monto, Descripcion,
    Numero_Operacion, Documento, Afecta_Efectivo,
    TIPO_MOVIMIENTO_CAJA ( N_TipoMovimiento, Signo ),
    CONCEPTO_CAJA ( N_Concepto ),
    METODO_PAGO ( N_MetodoPago ),
    USUARIO ( Logeo )
`

/**
 * Usuario para las columnas de auditoría USUCRE/USUMOD.
 * En la BD esas columnas son varchar(30) mientras que USUARIO.Logeo es
 * varchar(120) (puede ser un email completo), así que se recorta para
 * evitar el error 22001 "value too long for type character varying(30)".
 */
function usuarioAuditoria(sesion) {
    return String(sesion?.data?.Logeo || "WEB").substring(0, 30)
}

async function resolverSesion() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: { message: "Sin sesión" } }
    const { data: usuario, error } = await supabase
        .from("USUARIO")
        .select("ID_Usuario, Logeo, ESTADO, Bloqueado")
        .eq("auth_id", user.id)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (error) return { ok: false, error }
    if (!usuario) return { ok: false, error: { message: "Usuario no vinculado" } }
    if (usuario.Bloqueado === "1") return { ok: false, error: { message: "Usuario bloqueado" } }
    return { ok: true, data: usuario }
}

async function listarCajas() {
    const { data, error } = await supabase
        .from("CAJA")
        .select("ID_Caja, N_Caja, Descripcion, Ubicacion, Aperturada, Monto_Base")
        .eq("ESTADO", "1")
        .order("ID_Caja")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function obtenerAperturaAbierta() {
    const { data, error } = await supabase
        .from("APERTURA_CAJA")
        .select(APERTURA_SELECT)
        .eq("Situacion", "A")
        .eq("ESTADO", "1")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarAperturasCerradas() {
    const { data, error } = await supabase
        .from("APERTURA_CAJA")
        .select(APERTURA_SELECT)
        .eq("Situacion", "C")
        .eq("ESTADO", "1")
        .order("F_Apertura", { ascending: false })
        .limit(50)
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function aperturarCaja(idCaja, montoInicial) {
    const sesion = await resolverSesion()
    if (!sesion.ok) return sesion

    const usuAuditoria = usuarioAuditoria(sesion)

    const { data: existente } = await supabase
        .from("APERTURA_CAJA")
        .select("ID_AperturaCaja")
        .eq("Situacion", "A")
        .eq("ESTADO", "1")
        .maybeSingle()

    if (existente) return { ok: false, error: { message: "Ya hay una caja abierta. Ciérrala primero." } }

    const numeroTurno = `T${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`

    const { data, error } = await supabase
        .from("APERTURA_CAJA")
        .insert({
            ID_Caja: Number(idCaja),
            ID_Usuario: sesion.data.ID_Usuario,
            Numero_Turno: numeroTurno,
            Monto_Inicial: Number(montoInicial) || 0,
            Monto_Sistema: Number(montoInicial) || 0,
            Situacion: "A",
            USUCRE: usuAuditoria
        })
        .select(APERTURA_SELECT)
        .maybeSingle()

    if (error) return { ok: false, error }

    await supabase.from("CAJA").update({ Aperturada: "1" }).eq("ID_Caja", idCaja)

    return { ok: true, data }
}

async function listarMovimientos(idApertura) {
    const { data, error } = await supabase
        .from("MOVIMIENTO_CAJA")
        .select(MOVIMIENTO_SELECT)
        .eq("ID_AperturaCaja", idApertura)
        .order("F_Movimiento", { ascending: false })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarConceptos() {
    const { data, error } = await supabase
        .from("CONCEPTO_CAJA")
        .select(`
            ID_Concepto, N_Concepto, Descripcion, Afecta_Efectivo,
            TIPO_MOVIMIENTO_CAJA ( ID_TipoMovimiento, N_TipoMovimiento, Signo )
        `)
        .eq("ESTADO", "1")
        .order("ID_TipoMovimiento")
        .order("N_Concepto")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function listarMetodosPago() {
    const { data, error } = await supabase
        .from("METODO_PAGO")
        .select("ID_MetodoPago, N_MetodoPago, Es_Efectivo")
        .eq("ESTADO", "1")
        .order("ID_MetodoPago")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function registrarMovimiento(datos) {
    const sesion = await resolverSesion()
    if (!sesion.ok) return sesion

    const usuAuditoria = usuarioAuditoria(sesion)

    const { data: concepto, error: errConcepto } = await supabase
        .from("CONCEPTO_CAJA")
        .select("ID_TipoMovimiento, Afecta_Efectivo")
        .eq("ID_Concepto", datos.ID_Concepto)
        .maybeSingle()
    if (errConcepto) return { ok: false, error: errConcepto }
    if (!concepto) return { ok: false, error: { message: "Concepto no válido" } }

    const { data: metodo } = await supabase
        .from("METODO_PAGO")
        .select("Es_Efectivo")
        .eq("ID_MetodoPago", datos.ID_MetodoPago)
        .maybeSingle()

    const afectaEfectivo = (concepto.Afecta_Efectivo === "1" && metodo?.Es_Efectivo === "1") ? "1" : "0"

    const { data, error } = await supabase
        .from("MOVIMIENTO_CAJA")
        .insert({
            ID_AperturaCaja: Number(datos.ID_AperturaCaja),
            ID_TipoMovimiento: Number(concepto.ID_TipoMovimiento),
            ID_Concepto: Number(datos.ID_Concepto),
            ID_MetodoPago: Number(datos.ID_MetodoPago),
            ID_Usuario: sesion.data.ID_Usuario,
            Monto: Number(datos.Monto),
            Descripcion: datos.Descripcion ? String(datos.Descripcion).substring(0, 200) : null,
            Documento: datos.Documento ? String(datos.Documento).substring(0, 200) : null,
            Numero_Operacion: datos.Numero_Operacion ? String(datos.Numero_Operacion).substring(0, 30) : null,
            Afecta_Efectivo: afectaEfectivo,
            USUCRE: usuAuditoria
        })
        .select(MOVIMIENTO_SELECT)
        .maybeSingle()
    if (error) return { ok: false, error }

    return { ok: true, data }
}

async function cerrarCaja(idApertura, montoDeclarado, observacion) {
    const sesion = await resolverSesion()
    if (!sesion.ok) return sesion

    const usuAuditoria = usuarioAuditoria(sesion)

    const { data: apertura, error: errAp } = await supabase
        .from("APERTURA_CAJA")
        .select("Monto_Inicial, Monto_Sistema, ID_Caja")
        .eq("ID_AperturaCaja", idApertura)
        .eq("Situacion", "A")
        .maybeSingle()
    if (errAp) return { ok: false, error: errAp }
    if (!apertura) return { ok: false, error: { message: "No hay caja abierta con ese ID" } }

    const { data: movimientos } = await supabase
        .from("MOVIMIENTO_CAJA")
        .select("Monto, Afecta_Efectivo, TIPO_MOVIMIENTO_CAJA ( Signo )")
        .eq("ID_AperturaCaja", idApertura)
        .eq("Afecta_Efectivo", "1")
        .eq("ESTADO", "1")

    let totalIngresos = 0
    let totalEgresos = 0
    for (const m of movimientos || []) {
        const signo = m.TIPO_MOVIMIENTO_CAJA?.[0]?.Signo
        if (signo === "+") totalIngresos += Number(m.Monto)
        if (signo === "-") totalEgresos += Number(m.Monto)
    }

    const montoSistema = Number(apertura.Monto_Inicial) + totalIngresos - totalEgresos
    const diferencia = Number(montoDeclarado) - montoSistema

    const { data, error } = await supabase
        .from("APERTURA_CAJA")
        .update({
            ID_UsuarioCierre: sesion.data.ID_Usuario,
            F_Cierre: new Date().toISOString(),
            Total_Ingresos: totalIngresos,
            Total_Egresos: totalEgresos,
            Monto_Sistema: montoSistema,
            Monto_Declarado: Number(montoDeclarado),
            Diferencia: diferencia,
            Situacion: "C",
            Observacion: observacion || null,
            USUMOD: usuAuditoria,
            FECMOD: new Date().toISOString()
        })
        .eq("ID_AperturaCaja", idApertura)
        .select(APERTURA_SELECT)
        .maybeSingle()
    if (error) return { ok: false, error }

    await supabase.from("CAJA").update({ Aperturada: "0" }).eq("ID_Caja", apertura.ID_Caja)

    return { ok: true, data }
}

export const CajaAdapter = {
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

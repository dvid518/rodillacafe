import { cajaService } from "../../services/cajaService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML, formatearPrecio, formatearFecha } from "../../utils/format.js"

export async function cajaController(contenedor) {
    const [sesion] = await Promise.all([
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let cajas = []
    let conceptos = []
    let metodosPago = []
    let aperturaAbierta = null
    let aperturasCerradas = []
    let movimientos = []

    /* ---------- elementos DOM ---------- */

    const divEstadoActual = contenedor.querySelector("#caja-estado-actual")
    const divSinApertura = contenedor.querySelector("#caja-sin-apertura")
    const divResumen = contenedor.querySelector("#caja-estado-resumen")
    const divMovimientosSection = contenedor.querySelector("#caja-movimientos-section")
    const tbodyMovimientos = contenedor.querySelector("#caja-movimientos-tbody")
    const tbodyHistorial = contenedor.querySelector("#caja-historial-tbody")

    const btnAperturar = contenedor.querySelector("#caja-aperturar")
    const btnNuevoMovimiento = contenedor.querySelector("#caja-nuevo-movimiento")
    const btnCerrar = contenedor.querySelector("#caja-cerrar")

    const modalApertura = contenedor.querySelector("#caja-modal-apertura")
    const modalCierre = contenedor.querySelector("#caja-modal-cierre")
    const modalMovimiento = contenedor.querySelector("#caja-modal-movimiento")

    const selCaja = modalApertura.querySelector("#caja-input-caja")
    const inMontoInicial = modalApertura.querySelector("#caja-input-monto-inicial")
    const btnAperturaGuardar = modalApertura.querySelector("#caja-apertura-guardar")
    const btnAperturaCancelar = modalApertura.querySelector("#caja-apertura-cancelar")

    const divCierreResumen = modalCierre.querySelector("#caja-cierre-resumen")
    const inMontoDeclarado = modalCierre.querySelector("#caja-input-monto-declarado")
    const inObservacionCierre = modalCierre.querySelector("#caja-input-observacion-cierre")
    const btnCierreGuardar = modalCierre.querySelector("#caja-cierre-guardar")
    const btnCierreCancelar = modalCierre.querySelector("#caja-cierre-cancelar")

    const selConcepto = modalMovimiento.querySelector("#caja-input-concepto")
    const selMetodo = modalMovimiento.querySelector("#caja-input-metodo")
    const inMonto = modalMovimiento.querySelector("#caja-input-monto")
    const inDescripcion = modalMovimiento.querySelector("#caja-input-descripcion")
    const inDocumento = modalMovimiento.querySelector("#caja-input-documento")
    const btnMovimientoGuardar = modalMovimiento.querySelector("#caja-movimiento-guardar")
    const btnMovimientoCancelar = modalMovimiento.querySelector("#caja-movimiento-cancelar")

    /* ---------- carga inicial ---------- */

    async function cargar() {
        try {
            const [rCajas, rConceptos, rMetodos, rApertura, rCerradas] = await Promise.all([
                cajaService.listarCajas(),
                cajaService.listarConceptos(),
                cajaService.listarMetodosPago(),
                cajaService.obtenerAperturaAbierta(),
                cajaService.listarAperturasCerradas()
            ])

            if (rCajas.ok) cajas = rCajas.data
            else console.error("Error cargando cajas:", rCajas.error)

            if (rConceptos.ok) conceptos = rConceptos.data
            else console.error("Error cargando conceptos:", rConceptos.error)

            if (rMetodos.ok) metodosPago = rMetodos.data
            else console.error("Error cargando métodos de pago:", rMetodos.error)

            if (rApertura.ok) {
                aperturaAbierta = rApertura.data || null
            } else {
                console.error("Error cargando apertura abierta:", rApertura.error)
                notifyError(`No se pudo comprobar la apertura abierta: ${rApertura.error?.message || "error desconocido"}`)
            }

            if (rCerradas.ok) aperturasCerradas = rCerradas.data
            else console.error("Error cargando historial:", rCerradas.error)

            // Cargar movimientos de la apertura actual si existe
            if (aperturaAbierta) {
                const rMov = await cajaService.listarMovimientos(aperturaAbierta.ID_AperturaCaja)
                if (rMov.ok) movimientos = rMov.data
                else console.error("Error cargando movimientos:", rMov.error)
            }

            poblarSelects()
            render()
        } catch (error) {
            console.error("Error en cajaController.cargar:", error)
            notifyError(`Error inesperado: ${error.message}`)
            render()
        }
    }

    function poblarSelects() {
        selCaja.replaceChildren(
            ...cajas.map(c => {
                const o = document.createElement("option")
                o.value = c.ID_Caja
                o.textContent = `${escaparHTML(c.N_Caja || "Caja")} — ${escaparHTML(c.Descripcion || "")}`
                return o
            })
        )

        selConcepto.replaceChildren(
            ...conceptos.map(c => {
                const o = document.createElement("option")
                o.value = c.ID_Concepto
                o.textContent = `${escaparHTML(c.N_Concepto || "")} (${escaparHTML(c.TIPO_MOVIMIENTO_CAJA?.[0]?.N_TipoMovimiento || "")})`
                o.dataset.signo = c.TIPO_MOVIMIENTO_CAJA?.[0]?.Signo || ""
                o.dataset.afecta = c.Afecta_Efectivo || "0"
                return o
            })
        )

        selMetodo.replaceChildren(
            ...metodosPago.map(m => {
                const o = document.createElement("option")
                o.value = m.ID_MetodoPago
                o.textContent = escaparHTML(m.N_MetodoPago || "Pago")
                o.dataset.efectivo = m.Es_Efectivo || "0"
                return o
            })
        )
    }

    /* ---------- render ---------- */

    function render() {
        renderEstadoActual()
        renderMovimientos()
        renderHistorial()
    }

    function renderEstadoActual() {
        if (aperturaAbierta) {
            divEstadoActual.hidden = false
            divSinApertura.hidden = true

            const montoInicial = Number(aperturaAbierta.Monto_Inicial || 0)
            const ingresos = Number(aperturaAbierta.Total_Ingresos || 0)
            const egresos = Number(aperturaAbierta.Total_Egresos || 0)
            const sistema = Number(aperturaAbierta.Monto_Sistema || 0)

            const cajaNombre = aperturaAbierta.CAJA?.[0]?.N_Caja || aperturaAbierta.CAJA?.N_Caja || "-"
            const fechaApertura = formatearFecha(aperturaAbierta.F_Apertura, { dateStyle: "short", timeStyle: "short" })
            const sistemaNegativo = sistema < 0
            const sistemaTexto = sistemaNegativo
                ? `-S/ ${formatearPrecio(Math.abs(sistema))}`
                : `S/ ${formatearPrecio(sistema)}`
            const sistemaColor = sistemaNegativo ? "var(--state-danger)" : "var(--text)"

            divResumen.innerHTML = `
                <div class="caja-metricas">
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Turno</div>
                        <div class="caja-metrica__valor">${escaparHTML(aperturaAbierta.Numero_Turno || "-")}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Caja</div>
                        <div class="caja-metrica__valor">${escaparHTML(cajaNombre)}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Fecha apertura</div>
                        <div class="caja-metrica__valor">${fechaApertura}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Monto inicial</div>
                        <div class="caja-metrica__valor">S/ ${formatearPrecio(montoInicial)}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Ingresos</div>
                        <div class="caja-metrica__valor caja-metrica__valor--positivo">S/ ${formatearPrecio(ingresos)}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Egresos</div>
                        <div class="caja-metrica__valor caja-metrica__valor--negativo">S/ ${formatearPrecio(egresos)}</div>
                    </div>
                    <div class="caja-metrica">
                        <div class="caja-metrica__titulo">Monto sistema</div>
                        <div class="caja-metrica__valor ${sistemaNegativo ? "caja-metrica__valor--negativo" : ""}">${sistemaTexto}</div>
                    </div>
                </div>
                <div style="font-size:13px; color:var(--text-muted); margin-top: var(--space-sm);">
                    Usuario: ${escaparHTML(aperturaAbierta.USUARIO?.[0]?.Logeo || aperturaAbierta.USUARIO?.Logeo || "-")} — Situación: <span style="text-transform:uppercase;">${aperturaAbierta.Situacion}</span>
                </div>
            `
        } else {
            divEstadoActual.hidden = true
            divSinApertura.hidden = false
        }
    }

    function renderMovimientos() {
        if (!aperturaAbierta) {
            divMovimientosSection.hidden = true
            return
        }

        if (!movimientos.length) {
            tbodyMovimientos.innerHTML = '<tr class="fila-vacia"><td colspan="6">Sin movimientos en este turno.</td></tr>'
            divMovimientosSection.hidden = false
            return
        }

        divMovimientosSection.hidden = false
        tbodyMovimientos.innerHTML = movimientos.map(m => {
            const signo = m.TIPO_MOVIMIENTO_CAJA?.[0]?.Signo || "+"
            const esIngreso = signo === "+"
            const tipoTexto = m.TIPO_MOVIMIENTO_CAJA?.[0]?.N_TipoMovimiento || "-"
            const conceptoTexto = m.CONCEPTO_CAJA?.[0]?.N_Concepto || "-"
            const metodoTexto = m.METODO_PAGO?.[0]?.N_MetodoPago || "-"
            const monto = Number(m.Monto || 0)
            const hora = m.F_Movimiento ? new Date(m.F_Movimiento).toLocaleString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "-"

            return `
                <tr data-id="${m.ID_MovimientoCaja}">
                    <td>${hora}</td>
                    <td>${escaparHTML(conceptoTexto)}</td>
                    <td><span class="chip chip--estado-${esIngreso ? "i" : "e"}">${escaparHTML(tipoTexto)}</span></td>
                    <td>${escaparHTML(metodoTexto)}</td>
                    <td style="color:${esIngreso ? "var(--state-success)" : "var(--state-danger)"}; font-weight:600;">${esIngreso ? "+" : "-"}${formatearPrecio(monto)}</td>
                    <td>${escaparHTML(m.Descripcion || "-")}</td>
                </tr>
            `
        }).join("")
    }

    function renderHistorial() {
        if (!aperturasCerradas.length) {
            tbodyHistorial.innerHTML = '<tr class="fila-vacia"><td colspan="9">Sin turnos cerrados.</td></tr>'
            return
        }

        tbodyHistorial.innerHTML = aperturasCerradas.map(a => {
            const inicial = Number(a.Monto_Inicial || 0)
            const ingresos = Number(a.Total_Ingresos || 0)
            const egresos = Number(a.Total_Egresos || 0)
            const sistema = Number(a.Monto_Sistema || 0)
            const declarado = Number(a.Monto_Declarado || 0)
            const diferencia = Number(a.Diferencia || 0)
            const esCuadrada = diferencia === 0

            return `
                <tr data-id="${a.ID_AperturaCaja}">
                    <td>${escaparHTML(a.Numero_Turno || "-")}</td>
                    <td>${escaparHTML(a.F_Apertura || "-")}</td>
                    <td>${escaparHTML(a.F_Cierre || "-")}</td>
                    <td>S/ ${formatearPrecio(inicial)}</td>
                    <td>S/ ${formatearPrecio(ingresos)}</td>
                    <td>S/ ${formatearPrecio(egresos)}</td>
                    <td>S/ ${formatearPrecio(sistema)}</td>
                    <td>S/ ${formatearPrecio(declarado)}</td>
                    <td style="color:${esCuadrada ? "var(--state-success)" : "var(--state-danger)"}; font-weight:600;">${diferencia >= 0 ? "+" : ""}${formatearPrecio(diferencia)}</td>
                </tr>
            `
        }).join("")
    }

    /* ---------- acciones ---------- */

    async function aperturar() {
        const idCaja = Number(selCaja.value)
        const montoInicial = Number(inMontoInicial.value) || 0

        if (!idCaja) return notifyWarning("Selecciona una caja")
        if (montoInicial < 0) return notifyWarning("El monto inicial no puede ser negativo")

        btnAperturaGuardar.disabled = true
        const resultado = await cajaService.aperturarCaja(idCaja, montoInicial)
        btnAperturaGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al aperturar caja:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo aperturar la caja")
        }

        notifySuccess("Caja aperturada")
        modalApertura.hidden = true
        document.body.classList.remove("sin-scroll")
        await recargar()
    }

    async function abrirCierre() {
        if (!aperturaAbierta) return

        const sistema = Number(aperturaAbierta.Monto_Sistema || 0)
        divCierreResumen.innerHTML = `
            <div class="caja-cierre-resumen">
                <div style="font-size:13px; color:var(--text-muted); margin-bottom: var(--space-sm);">Resumen del turno</div>
                <div class="caja-cierre-resumen__fila">
                    <span class="caja-cierre-resumen__etiqueta">Ingresos:</span>
                    <span class="caja-cierre-resumen__valor caja-metrica__valor--positivo">S/ ${formatearPrecio(Number(aperturaAbierta.Total_Ingresos || 0))}</span>
                </div>
                <div class="caja-cierre-resumen__fila">
                    <span class="caja-cierre-resumen__etiqueta">Egresos:</span>
                    <span class="caja-cierre-resumen__valor caja-metrica__valor--negativo">S/ ${formatearPrecio(Number(aperturaAbierta.Total_Egresos || 0))}</span>
                </div>
                <div class="caja-cierre-resumen__fila">
                    <span class="caja-cierre-resumen__etiqueta">Monto sistema:</span>
                    <span class="caja-cierre-resumen__valor ${sistema < 0 ? "caja-metrica__valor--negativo" : ""}">S/ ${formatearPrecio(sistema)}</span>
                </div>
            </div>
        `
        inMontoDeclarado.value = sistema
        inObservacionCierre.value = ""
        modalCierre.hidden = false
        document.body.classList.add("sin-scroll")
        inMontoDeclarado.focus()
    }

    async function cerrar() {
        const montoDeclarado = Number(inMontoDeclarado.value) || 0
        const observacion = inObservacionCierre.value.trim() || null

        if (montoDeclarado < 0) return notifyWarning("El monto declarado no puede ser negativo")

        btnCierreGuardar.disabled = true
        const resultado = await cajaService.cerrarCaja(aperturaAbierta.ID_AperturaCaja, montoDeclarado, observacion)
        btnCierreGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al cerrar caja:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo cerrar la caja")
        }

        const dif = Number(resultado.data.Diferencia || 0)
        const msg = dif === 0 ? "Caja cerrada cuadrada" : `Caja cerrada con diferencia de S/ ${formatearPrecio(Math.abs(dif))}`
        notifySuccess(msg)
        modalCierre.hidden = true
        document.body.classList.remove("sin-scroll")
        await recargar()
    }

    async function abrirMovimiento() {
        if (!aperturaAbierta) return
        selConcepto.value = ""
        selMetodo.value = ""
        inMonto.value = ""
        inDescripcion.value = ""
        inDocumento.value = ""
        modalMovimiento.hidden = false
        document.body.classList.add("sin-scroll")
        selConcepto.focus()
    }

    async function registrarMovimiento() {
        const idConcepto = Number(selConcepto.value)
        const idMetodo = Number(selMetodo.value)
        const monto = Number(inMonto.value)
        const descripcion = inDescripcion.value.trim() || null
        const documento = inDocumento.value.trim() || null

        if (!idConcepto) return notifyWarning("Selecciona un concepto")
        if (!idMetodo) return notifyWarning("Selecciona un método de pago")
        if (!monto || monto <= 0) return notifyWarning("El monto debe ser mayor a 0")

        btnMovimientoGuardar.disabled = true
        const resultado = await cajaService.registrarMovimiento({
            ID_AperturaCaja: aperturaAbierta.ID_AperturaCaja,
            ID_Concepto: idConcepto,
            ID_MetodoPago: idMetodo,
            Monto: monto,
            Descripcion: descripcion,
            Documento: documento
        })
        btnMovimientoGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al registrar movimiento:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo registrar el movimiento")
        }

        notifySuccess("Movimiento registrado")
        modalMovimiento.hidden = true
        document.body.classList.remove("sin-scroll")
        await recargar()
    }

    async function recargar() {
        const rApertura = await cajaService.obtenerAperturaAbierta()
        if (rApertura.ok) aperturaAbierta = rApertura.data || null

        const rCerradas = await cajaService.listarAperturasCerradas()
        if (rCerradas.ok) aperturasCerradas = rCerradas.data

        if (aperturaAbierta) {
            const rMov = await cajaService.listarMovimientos(aperturaAbierta.ID_AperturaCaja)
            if (rMov.ok) movimientos = rMov.data
        } else {
            movimientos = []
        }

        render()
    }

    /* ---------- eventos ---------- */

    btnAperturar.addEventListener("click", () => {
        inMontoInicial.value = "100"
        modalApertura.hidden = false
        document.body.classList.add("sin-scroll")
        selCaja.focus()
    })

    btnAperturaCancelar.addEventListener("click", () => {
        modalApertura.hidden = true
        document.body.classList.remove("sin-scroll")
    })
    btnAperturaGuardar.addEventListener("click", aperturar)

    btnCerrar.addEventListener("click", abrirCierre)
    btnCierreCancelar.addEventListener("click", () => {
        modalCierre.hidden = true
        document.body.classList.remove("sin-scroll")
    })
    btnCierreGuardar.addEventListener("click", cerrar)

    btnNuevoMovimiento.addEventListener("click", abrirMovimiento)
    btnMovimientoCancelar.addEventListener("click", () => {
        modalMovimiento.hidden = true
        document.body.classList.remove("sin-scroll")
    })
    btnMovimientoGuardar.addEventListener("click", registrarMovimiento)

    modalApertura.addEventListener("click", e => { if (e.target === modalApertura) { modalApertura.hidden = true; document.body.classList.remove("sin-scroll") } })
    modalCierre.addEventListener("click", e => { if (e.target === modalCierre) { modalCierre.hidden = true; document.body.classList.remove("sin-scroll") } })
    modalMovimiento.addEventListener("click", e => { if (e.target === modalMovimiento) { modalMovimiento.hidden = true; document.body.classList.remove("sin-scroll") } })

    const onEscape = e => {
        if (e.key === "Escape") {
            if (!modalApertura.hidden) { modalApertura.hidden = true; document.body.classList.remove("sin-scroll") }
            if (!modalCierre.hidden) { modalCierre.hidden = true; document.body.classList.remove("sin-scroll") }
            if (!modalMovimiento.hidden) { modalMovimiento.hidden = true; document.body.classList.remove("sin-scroll") }
        }
    }
    document.addEventListener("keydown", onEscape)

    await cargar()

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

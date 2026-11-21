import { cajaService } from "../../services/cajaService.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"

/* ==========================================================================
   APERTURA DE CAJA — compartida por Pedidos y Nueva venta
   --------------------------------------------------------------------------
   Resuelve true si quedó un turno abierto, false si el usuario canceló o la
   apertura falló. No duplica reglas: usa cajaService, que es el mismo que
   consume el módulo Caja.
   ========================================================================== */
export async function solicitarAperturaCaja() {
    const Modal = (await import("../../components/Modal.js")).Modal

    const rCajas = await cajaService.listarCajas()

    // Sin permiso para listar cajas (RLS): no bloquear el pedido. El cobro
    // vuelve a exigir un turno abierto, así que no se salta ningún control.
    if (!rCajas.ok) {
        console.warn("No se pudieron listar cajas:", rCajas.error)
        notifyWarning("No se pudieron consultar las cajas. Puedes registrar el pedido; el cobro exige caja abierta.")
        return true
    }

    const cajas = rCajas.data || []
    if (!cajas.length) {
        notifyError("No hay cajas configuradas para abrir un turno.")
        return false
    }

    let resolveValor = null
    const formHtml = `
        <div style="display:flex; flex-direction:column; gap: var(--space-sm);">
            <div class="modal-form__campo">
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Caja *</label>
                <select class="input" id="apertura-caja">
                    ${cajas.map(c => `<option value="${c.ID_Caja}">${escaparHTML(c.N_Caja || "Caja")}</option>`).join("")}
                </select>
            </div>
            <div class="modal-form__campo">
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:var(--space-xs);">Monto inicial *</label>
                <input class="input" type="number" id="apertura-monto-inicial" step="0.01" min="0" value="100">
            </div>
        </div>
    `

    const modal = new Modal({
        title: "Abrir caja",
        body: formHtml,
        actions: [
            {
                label: "Cancelar",
                className: "btn btn--ghost",
                onClick: (m) => { m.close(); if (resolveValor) resolveValor(false) }
            },
            {
                label: "Abrir caja",
                className: "btn btn--primary",
                onClick: async (m, boton) => {
                    boton.disabled = true
                    const select = document.getElementById("apertura-caja")
                    const input = document.getElementById("apertura-monto-inicial")
                    const idCaja = Number(select?.value)
                    const montoInicial = Number(input?.value) || 0

                    if (!idCaja) {
                        boton.disabled = false
                        return notifyWarning("Selecciona una caja")
                    }
                    if (montoInicial < 0) {
                        boton.disabled = false
                        return notifyWarning("El monto inicial no puede ser negativo")
                    }

                    const resultado = await cajaService.aperturarCaja(idCaja, montoInicial)
                    boton.disabled = false

                    if (!resultado.ok) {
                        console.error("Error al aperturar caja:", resultado.error)
                        return notifyError(resultado.error?.message || "No se pudo aperturar la caja")
                    }

                    notifySuccess("Caja aperturada")
                    // Resolver antes de cerrar: Modal.close() dispara onClose
                    // sincrónicamente y resolvería false.
                    if (resolveValor) resolveValor(true)
                    resolveValor = null
                    m.close()
                }
            }
        ],
        onClose: () => {
            if (resolveValor) resolveValor(false)
        }
    })

    modal.open()

    return new Promise((resolve) => {
        resolveValor = resolve
    })
}

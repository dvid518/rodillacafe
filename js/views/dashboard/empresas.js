import { empresaService } from "../../services/empresaService.js"
import { rucService } from "../../services/rucService.js"
import { authService } from "../../services/authService.js"
import { Modal } from "../../components/Modal.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"

export async function empresasController(contenedor) {
    const [empresasR, sesion] = await Promise.all([
        empresaService.listarEmpresas(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let empresas = empresasR.ok ? empresasR.data : []
    let editandoId = null

    const tbodyEl = contenedor.querySelector("#empresas-tbody")
    const modalEl = contenedor.querySelector("#empresas-modal")
    const inRuc = modalEl.querySelector("#empresas-input-ruc")
    const inRazon = modalEl.querySelector("#empresas-input-razon")
    const inComercial = modalEl.querySelector("#empresas-input-comercial")
    const inDireccion = modalEl.querySelector("#empresas-input-direccion")
    const inTelefono = modalEl.querySelector("#empresas-input-telefono")
    const inEmail = modalEl.querySelector("#empresas-input-email")
    const btnGuardar = modalEl.querySelector("#empresas-modal-guardar")
    const btnCancelar = modalEl.querySelector("#empresas-modal-cancelar")
    const btnNuevo = contenedor.querySelector("#empresas-nuevo")
    const titulo = modalEl.querySelector("#empresas-modal-titulo")

    /* ---------- tabla ---------- */

    function pintarTabla() {
        if (!empresas.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="9">No hay empresas. Crea la primera.</td></tr>'
            return
        }

        tbodyEl.innerHTML = empresas.map(e => `
            <tr data-id="${e.ID_Empresa}">
                <td>${e.ID_Empresa}</td>
                <td><strong>${escaparHTML(e.RUC || "-")}</strong></td>
                <td>${escaparHTML(e.Razon_Social || "-")}</td>
                <td>${escaparHTML(e.Nombre_Comercial || "-")}</td>
                <td>${escaparHTML(e.Direccion || "-")}</td>
                <td>${escaparHTML(e.Telefono || "-")}</td>
                <td>${escaparHTML(e.EMAIL || "-")}</td>
                <td>
                    <button class="btn-icono" type="button" data-accion="editar" data-id="${e.ID_Empresa}" title="Editar" aria-label="Editar empresa ${e.ID_Empresa}">${icono("pencil", { size: 16 })}</button>
                </td>
                <td>
                    <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar" data-id="${e.ID_Empresa}" title="Eliminar" aria-label="Eliminar empresa ${e.ID_Empresa}">${icono("trash-2", { size: 16 })}</button>
                </td>
            </tr>
        `).join("")
    }

    /* ---------- modal ---------- */

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nueva empresa"
        inRuc.value = ""
        inRazon.value = ""
        inComercial.value = ""
        inDireccion.value = ""
        inTelefono.value = ""
        inEmail.value = ""
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        inRuc.focus()
    }

    function abrirEdicion(empresa) {
        editandoId = empresa.ID_Empresa
        titulo.textContent = `Editar empresa ${empresa.ID_Empresa}`
        inRuc.value = empresa.RUC || ""
        inRazon.value = empresa.Razon_Social || ""
        inComercial.value = empresa.Nombre_Comercial || ""
        inDireccion.value = empresa.Direccion || ""
        inTelefono.value = empresa.Telefono || ""
        inEmail.value = empresa.EMAIL || ""
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        inRuc.focus()
    }

    function cerrarModal() {
        modalEl.hidden = true
        editandoId = null
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        const ruc = String(inRuc.value || "").trim()
        if (!ruc) return notifyWarning("El RUC es obligatorio")

        const datos = {
            RUC: ruc,
            Razon_Social: inRazon.value.trim() || null,
            Nombre_Comercial: inComercial.value.trim() || null,
            Direccion: inDireccion.value.trim() || null,
            Telefono: inTelefono.value.trim() || null,
            EMAIL: inEmail.value.trim() || null,
            USUCRE: usucre
        }

        btnGuardar.disabled = true
        const resultado = editandoId
            ? await empresaService.actualizarEmpresa(editandoId, datos)
            : await empresaService.crearEmpresa(datos)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al guardar empresa:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo guardar la empresa")
        }

        notifySuccess(editandoId ? "Empresa actualizada" : "Empresa creada")
        cerrarModal()
        await recargar()
    }

    async function eliminarEmpresa(id) {
        const empresa = empresas.find(e => e.ID_Empresa === id)
        if (!empresa) return

        const confirmacion = new Modal({
            title: "Eliminar empresa",
            body: `<p>Se desactivara la empresa <strong>${escaparHTML(empresa.Razon_Social || "sin nombre")}</strong> (RUC ${escaparHTML(empresa.RUC || "-")}).</p>
                   <p class="modal-nota">Es un borrado logico: se marca como inactiva y no se puede deshacer desde aqui.</p>`,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Eliminar",
                    className: "btn btn--danger",
                    onClick: async (modal, boton) => {
                        boton.disabled = true
                        const resultado = await empresaService.eliminarEmpresa(id)
                        boton.disabled = false
                        modal.close()
                        if (!resultado.ok) {
                            console.error("Error al eliminar empresa:", resultado.error)
                            return notifyError("No se pudo eliminar la empresa")
                        }
                        notifySuccess("Empresa eliminada")
                        await recargar()
                    }
                }
            ]
        })
        confirmacion.open()
    }

    async function recargar() {
        const r = await empresaService.listarEmpresas()
        if (r.ok) {
            empresas = r.data
        } else {
            console.error("Error al recargar empresas:", r.error)
            return notifyError("No se pudieron recargar las empresas")
        }
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    /* ---------- autocompletado RUC (Factiliza) ---------- */

    let timeoutRuc = null
    let ultimoRucConsultado = ""

    inRuc.addEventListener("input", (e) => {
        const ruc = String(e.target.value || "").replace(/\D/g, "")

        // Solo buscar cuando tenga 11 dígitos
        if (ruc.length !== 11) return
        if (ruc === ultimoRucConsultado) return

        // Debounce de 500ms
        clearTimeout(timeoutRuc)
        timeoutRuc = setTimeout(async () => {
            ultimoRucConsultado = ruc

            // Feedback de carga: deshabilitar input y cambiar texto del botón
            inRuc.disabled = true
            const textoOriginal = btnGuardar.textContent
            btnGuardar.textContent = "Consultando RUC..."

            const resultado = await rucService.consultarRUC(ruc)

            // Quitar feedback de carga
            inRuc.disabled = false
            btnGuardar.textContent = textoOriginal

            if (!resultado.ok) {
                notifyWarning(`No se pudo consultar el RUC: ${resultado.error.message}`)
                btnGuardar.disabled = false
                return
            }

            const data = resultado.data

            // Solo rellenar si los campos están vacíos (no sobreescribir datos del usuario)
            if (inRazon && !inRazon.value) {
                inRazon.value = data.razonSocial || ""
            }
            if (inDireccion && !inDireccion.value) {
                inDireccion.value = data.direccion || ""
            }
            if (inComercial && !inComercial.value && data.nombreComercial) {
                inComercial.value = data.nombreComercial
            }

            if (data.yaExiste) {
                notifyInfo("Esta empresa ya está registrada")
                btnGuardar.disabled = true
            } else {
                notifySuccess(`Empresa encontrada en SUNAT: ${data.razonSocial || "sin nombre"}`)
                btnGuardar.disabled = false
            }
        }, 500)
    })

    pintarTabla()

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const empresa = empresas.find(e => e.ID_Empresa === Number(btn.dataset.id))
        if (!empresa) return
        if (btn.dataset.accion === "editar") abrirEdicion(empresa)
        else eliminarEmpresa(empresa.ID_Empresa)
    })

    btnNuevo.addEventListener("click", abrirNuevo)
    btnCancelar.addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => { if (e.key === "Escape" && !modalEl.hidden) cerrarModal() }
    document.addEventListener("keydown", onEscape)

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

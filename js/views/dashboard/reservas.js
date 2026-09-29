import { guardRol } from "../../session/roleGuard.js"
import { reservationService } from "../../services/reservationService.js"
import { userService } from "../../services/userService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import {
    ESTADO_RESERVA, badge, filaVacia, filaError, opcionesEstado,
    abrirModal, cerrarModal, cerrarConEscape, poblarClientes,
    mapaUsuarios, confirmarBorrado,
} from "./crud-comun.js"

const CELDAS = 9

/** <input type="datetime-local"> no entiende de zonas: se pasa tal cual. */
function aLocalInput(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const dos = n => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

function formatearHora(iso) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export async function reservasController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return

    const esAdmin = roles.includes("ADMINISTRADOR")

    const tbody = contenedor.querySelector("#reservas-tbody")
    const modal = contenedor.querySelector("#reservas-modal")
    const aviso = contenedor.querySelector("#reservas-aviso")

    const titulo = modal.querySelector("#reservas-modal-titulo")
    const selCliente = modal.querySelector("#reservas-input-cliente")
    const inFecha = modal.querySelector("#reservas-input-fecha")
    const inPersonas = modal.querySelector("#reservas-input-personas")
    const selEstado = modal.querySelector("#reservas-input-estado")
    const campoEstado = modal.querySelector("#reservas-campo-estado")
    const inObservacion = modal.querySelector("#reservas-input-observacion")
    const btnGuardar = modal.querySelector("#reservas-modal-guardar")

    let reservas = []
    let clientes = []
    let usuariosPorId = new Map()
    let editandoId = null
    let usucre = "WEB"

    const [rReservas, rClientes, rUsuarios, sesion] = await Promise.all([
        reservationService.listarTodas(),
        userService.listarClientes(),
        userService.listarUsuarios(),
        authService.obtenerSesion(),
    ])

    reservas = rReservas.ok ? rReservas.data : []
    clientes = rClientes.ok ? rClientes.data : []
    usuariosPorId = mapaUsuarios(rUsuarios.ok ? rUsuarios.data : [])
    usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    const puedeCrear = esAdmin && clientes.length > 0

    if (!esAdmin) {
        contenedor.querySelectorAll(".js-solo-admin").forEach(el => el.remove())
    }
    if (esAdmin && clientes.length === 0) {
        aviso.hidden = false
        aviso.textContent = "No hay clientes visibles para tu cuenta: no puedes registrar reservas manualmente."
    }

    poblarClientes(selCliente, clientes)
    selEstado.innerHTML = opcionesEstado(ESTADO_RESERVA)

    function nombreDe(reserva) {
        const persona = reserva.CLIENTE?.[0]?.PERSONA?.[0]
        if (persona?.Nombre) {
            return [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim()
        }
        return `Cliente #${reserva.ID_Cliente ?? "?"}`
    }

    function iconoBoton(nombre, accion, id, etiqueta, clase = "") {
        // icono(), no icon().outerHTML: el <svg> de Reicon vive en su shadow
        // root, asi que outerHTML de un <re-icon> recien creado sale vacio
        const svg = icono(nombre, { size: 16 })
        return `<button class="btn-icono ${clase}" type="button" data-accion="${accion}" data-id="${id}" title="${escaparHTML(etiqueta)}" aria-label="${escaparHTML(etiqueta)}">${svg}</button>`
    }

    function pintarTabla() {
        if (!rReservas.ok) {
            tbody.innerHTML = filaError(CELDAS, "las reservas")
            return
        }
        if (!reservas.length) {
            tbody.innerHTML = filaVacia(CELDAS, "Todavía no hay reservas")
            return
        }

        const lista = [...reservas].sort((a, b) => (b.F_Reserva || "").localeCompare(a.F_Reserva || ""))
        tbody.innerHTML = lista.map(r => `
            <tr>
                <td>${r.ID_Reserva}</td>
                <td>${escaparHTML(nombreDe(r))}</td>
                <td>${escaparHTML(formatearFecha(r.F_Reserva, { dateStyle: "medium" }))}</td>
                <td>${escaparHTML(formatearHora(r.F_Reserva))}</td>
                <td>${r.N_Comensales ?? "—"}</td>
                <td>${badge(ESTADO_RESERVA, r.Situacion)}</td>
                <td class="celda-obs">${escaparHTML(r.Observacion || "—")}</td>
                <td>${iconoBoton("pencil", "editar", r.ID_Reserva, `Editar reserva ${r.ID_Reserva}`)}</td>
                <td>${esAdmin ? iconoBoton("trash-2", "eliminar", r.ID_Reserva, `Eliminar reserva ${r.ID_Reserva}`, "btn-icono--peligro") : ""}</td>
            </tr>
        `).join("")
    }

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nueva reserva"
        selCliente.value = ""
        selCliente.disabled = false
        // por defecto dentro de una hora, que es lo que casi siempre se quiere
        const manana = new Date(Date.now() + 3600_000)
        manana.setSeconds(0, 0)
        inFecha.value = aLocalInput(manana.toISOString())
        inPersonas.value = 2
        inObservacion.value = ""
        campoEstado.hidden = true
        abrirModal(modal, selCliente)
    }

    function abrirEdicion(id) {
        const reserva = reservas.find(r => String(r.ID_Reserva) === String(id))
        if (!reserva) return
        editandoId = id
        titulo.textContent = `Editar reserva #${id}`
        selCliente.value = reserva.ID_Cliente ?? ""
        // el cliente no se cambia: habria que reasignar la mesa
        selCliente.disabled = true
        inFecha.value = aLocalInput(reserva.F_Reserva)
        inPersonas.value = reserva.N_Comensales ?? 2
        selEstado.value = reserva.Situacion || "P"
        campoEstado.hidden = false
        inObservacion.value = reserva.Observacion || ""
        abrirModal(modal, selEstado)
    }

    async function guardar() {
        const personas = Number(inPersonas.value)
        if (!inFecha.value) {
            mostrarAviso("Indica la fecha y la hora")
            return
        }
        if (!Number.isFinite(personas) || personas < 1) {
            mostrarAviso("El número de personas debe ser al menos 1")
            return
        }

        btnGuardar.disabled = true
        try {
            if (editandoId) {
                const resultado = await reservationService.actualizarReserva(editandoId, {
                    N_Comensales: personas,
                    F_Reserva: new Date(inFecha.value).toISOString(),
                    Situacion: selEstado.value,
                    Observacion: inObservacion.value.trim(),
                })
                if (!resultado.ok) {
                    console.error("Error al actualizar reserva:", resultado.error)
                    return notifyError("No se pudo actualizar la reserva")
                }
                notifySuccess("Reserva actualizada")
            } else {
                const idCliente = Number(selCliente.value)
                if (!idCliente) return notifyWarning("Selecciona un cliente")
                const resultado = await reservationService.crearReservaManual({
                    ID_Cliente: idCliente,
                    N_Comensales: personas,
                    F_Reserva: new Date(inFecha.value).toISOString(),
                    Observacion: inObservacion.value.trim(),
                    USUCRE: usucre,
                })
                if (!resultado.ok) {
                    console.error("Error al crear reserva:", resultado.error)
                    return notifyError(resultado.error?.message || "No se pudo crear la reserva")
                }
                notifySuccess("Reserva creada")
            }
        } finally {
            btnGuardar.disabled = false
        }

        cerrarModal(modal)
        await recargar()
    }

    /** Aviso en linea dentro del modal: un toast se va solo y con un formulario
        largo el usuario puede no reachlo. */
    function mostrarAviso(texto) {
        let p = modal.querySelector(".modal-form__aviso")
        if (!p) {
            p = document.createElement("p")
            p.className = "modal-form__aviso"
            modal.querySelector(".modal-form__acciones").before(p)
        }
        p.textContent = texto
        p.hidden = false
    }

    async function eliminar(id) {
        const reserva = reservas.find(r => String(r.ID_Reserva) === String(id))
        if (!reserva) return
        confirmarBorrado({
            titulo: "Eliminar reserva",
            cuerpo: `<p>Se eliminara la reserva <strong>#${id}</strong>${reserva.CLIENTE?.[0]?.PERSONA?.[0]?.Nombre ? ` de ${escaparHTML(reserva.CLIENTE[0].PERSONA[0].Nombre)}` : ""}.</p>
                     <p class="modal-nota modal-nota--peligro">Borrado fisico, no se puede deshacer.</p>`,
            onConfirm: async () => {
                const resultado = await reservationService.eliminarReserva(id)
                if (!resultado.ok) {
                    console.error("Error al eliminar reserva:", resultado.error)
                    return notifyError("No se pudo eliminar la reserva")
                }
                notifySuccess("Reserva eliminada")
                await recargar()
            },
        })
    }

    async function recargar() {
        const r = await reservationService.listarTodas()
        if (r.ok) reservas = r.data
        else {
            console.error("Error al recargar reservas:", r.error)
            notifyError("No se pudo actualizar la lista")
        }
        pintarTabla()
    }

    tbody.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        if (btn.dataset.accion === "editar") abrirEdicion(btn.dataset.id)
        else if (btn.dataset.accion === "eliminar") eliminar(btn.dataset.id)
    })

    const btnNuevo = contenedor.querySelector("#reservas-nuevo")
    if (btnNuevo && puedeCrear) btnNuevo.addEventListener("click", abrirNuevo)

    modal.querySelector("#reservas-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    btnGuardar.addEventListener("click", guardar)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    const cleanup = cerrarConEscape(modal)
    pintarTabla()

    return cleanup
}

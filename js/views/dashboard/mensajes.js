import { unwrapEmbed } from "../../utils/supabaseHelpers.js"
import { guardRol } from "../../session/roleGuard.js"
import { messageService } from "../../services/messageService.js"
import { userService } from "../../services/userService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import {
    ESTADO_MENSAJE, badge, filaVacia, filaError, opcionesEstado,
    abrirModal, cerrarModal, cerrarConEscape, poblarClientes,
    confirmarBorrado,
} from "./crud-comun.js"

const CELDAS = 6

export async function mensajesController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return

    const esAdmin = roles.includes("ADMINISTRADOR")

    const tbody = contenedor.querySelector("#mensajes-tbody")
    const modal = contenedor.querySelector("#mensajes-modal")
    const aviso = contenedor.querySelector("#mensajes-aviso")

    const titulo = modal.querySelector("#mensajes-modal-titulo")
    const selCliente = modal.querySelector("#mensajes-input-cliente")
    const inAsunto = modal.querySelector("#mensajes-input-asunto")
    const inTexto = modal.querySelector("#mensajes-input-texto")
    const selEstado = modal.querySelector("#mensajes-input-estado")
    const campoEstado = modal.querySelector("#mensajes-campo-estado")
    const btnGuardar = modal.querySelector("#mensajes-modal-guardar")

    let mensajes = []
    let clientes = []
    let editandoId = null
    let usucre = "WEB"

    const [rMensajes, rClientes, sesion] = await Promise.all([
        messageService.listarTodos(),
        userService.listarClientes(),
        authService.obtenerSesion(),
    ])

    mensajes = rMensajes.ok ? rMensajes.data : []
    clientes = rClientes.ok ? rClientes.data : []
    usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    if (!esAdmin) {
        contenedor.querySelectorAll(".js-solo-admin").forEach(el => el.remove())
    }
    if (esAdmin && clientes.length === 0) {
        aviso.hidden = false
        aviso.textContent = "No hay clientes visibles para tu cuenta: no puedes registrar mensajes manualmente."
    }

    poblarClientes(selCliente, clientes)
    selEstado.innerHTML = opcionesEstado(ESTADO_MENSAJE)

    function nombreDe(mensaje) {
        const persona = unwrapEmbed(unwrapEmbed(mensaje.CLIENTE)?.PERSONA)
        if (persona?.Nombre) {
            return [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim()
        }
        return `Cliente #${mensaje.ID_Cliente ?? "?"}`
    }

    function pintarTabla() {
        if (!rMensajes.ok) {
            tbody.innerHTML = filaError(CELDAS, "los mensajes")
            return
        }
        if (!mensajes.length) {
            tbody.innerHTML = filaVacia(CELDAS, "No hay mensajes en la bandeja")
            return
        }

        const lista = [...mensajes].sort((a, b) => (b.F_Envio || b.FECCRE || "").localeCompare(a.F_Envio || a.FECCRE || ""))
        tbody.innerHTML = lista.map(m => `
            <tr data-id="${m.ID_Mensaje}" class="fila-mensaje" role="button" tabindex="0" aria-label="Ver mensaje ${m.ID_Mensaje}">
                <td>${m.ID_Mensaje}</td>
                <td>${escaparHTML(nombreDe(m))}</td>
                <td>${escaparHTML(formatearFecha(m.F_Envio || m.FECCRE, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(m.Asunto || "—")}</td>
                <td class="celda-obs">${escaparHTML(m.Mensaje || "—")}</td>
                <td>${badge(ESTADO_MENSAJE, m.Situacion)}</td>
            </tr>
        `).join("")
    }

    async function recargar() {
        const r = await messageService.listarTodos()
        if (r.ok) mensajes = r.data
        else {
            console.error("Error al recargar mensajes:", r.error)
            notifyError("No se pudo actualizar la lista")
        }
        pintarTabla()
    }

    function verMensaje(id) {
        const mensaje = mensajes.find(m => String(m.ID_Mensaje) === String(id))
        if (!mensaje) return
        editandoId = null
        titulo.textContent = `Mensaje #${mensaje.ID_Mensaje}`
        selCliente.disabled = true
        inAsunto.disabled = true
        inTexto.disabled = true
        selEstado.disabled = true
        campoEstado.hidden = false
        selCliente.value = mensaje.ID_Cliente ?? ""
        inAsunto.value = mensaje.Asunto || ""
        inTexto.value = mensaje.Mensaje || ""
        selEstado.value = mensaje.Situacion || "P"
        btnGuardar.hidden = true
        modal.querySelector("#mensajes-modal-cancelar").textContent = "Cerrar"
        abrirModal(modal, null)
    }

    tbody.addEventListener("click", e => {
        const fila = e.target.closest("tr.fila-mensaje")
        if (!fila) return
        verMensaje(fila.dataset.id)
    })
    tbody.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return
        const fila = e.target.closest("tr.fila-mensaje")
        if (!fila) return
        e.preventDefault()
        verMensaje(fila.dataset.id)
    })

    const btnNuevo = contenedor.querySelector("#mensajes-nuevo")
    if (btnNuevo) btnNuevo.remove()

    modal.querySelector("#mensajes-modal-cancelar").addEventListener("click", () => {
        btnGuardar.hidden = false
        modal.querySelector("#mensajes-modal-cancelar").textContent = "Cancelar"
        cerrarModal(modal)
    })
    btnGuardar.addEventListener("click", () => cerrarModal(modal))
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    const cleanup = cerrarConEscape(modal)
    pintarTabla()

    return cleanup
}

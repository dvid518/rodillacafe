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

const CELDAS = 8

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

    const puedeCrear = esAdmin && clientes.length > 0

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
        const persona = mensaje.CLIENTE?.[0]?.PERSONA?.[0]
        if (persona?.Nombre) {
            return [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim()
        }
        return `Cliente #${mensaje.ID_Cliente ?? "?"}`
    }

    function iconoBoton(nombre, accion, id, etiqueta, clase = "") {
        // icono(), no icon().outerHTML: el <svg> de Reicon vive en su shadow
        // root, asi que outerHTML de un <re-icon> recien creado sale vacio
        const svg = icono(nombre, { size: 16 })
        return `<button class="btn-icono ${clase}" type="button" data-accion="${accion}" data-id="${id}" title="${escaparHTML(etiqueta)}" aria-label="${escaparHTML(etiqueta)}">${svg}</button>`
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
            <tr>
                <td>${m.ID_Mensaje}</td>
                <td>${escaparHTML(nombreDe(m))}</td>
                <td>${escaparHTML(formatearFecha(m.F_Envio || m.FECCRE, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(m.Asunto || "—")}</td>
                <td class="celda-obs">${escaparHTML(m.Mensaje || "—")}</td>
                <td>${badge(ESTADO_MENSAJE, m.Situacion)}</td>
                <td>${iconoBoton("pencil", "editar", m.ID_Mensaje, `Editar mensaje ${m.ID_Mensaje}`)}</td>
                <td>${esAdmin ? iconoBoton("trash-2", "eliminar", m.ID_Mensaje, `Eliminar mensaje ${m.ID_Mensaje}`, "btn-icono--peligro") : ""}</td>
            </tr>
        `).join("")
    }

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nuevo mensaje"
        selCliente.value = ""
        selCliente.disabled = false
        inAsunto.value = ""
        inTexto.value = ""
        campoEstado.hidden = true
        abrirModal(modal, selCliente)
    }

    function abrirEdicion(id) {
        const mensaje = mensajes.find(m => String(m.ID_Mensaje) === String(id))
        if (!mensaje) return
        editandoId = id
        titulo.textContent = `Editar mensaje #${id}`
        selCliente.value = mensaje.ID_Cliente ?? ""
        selCliente.disabled = true
        inAsunto.value = mensaje.Asunto || ""
        inTexto.value = mensaje.Mensaje || ""
        selEstado.value = mensaje.Situacion || "P"
        campoEstado.hidden = false
        abrirModal(modal, selEstado)
    }

    async function guardar() {
        const texto = inTexto.value.trim()
        if (!texto) return notifyWarning("El mensaje está vacío")

        btnGuardar.disabled = true
        try {
            if (editandoId) {
                const resultado = await messageService.actualizarMensaje(editandoId, {
                    Asunto: inAsunto.value.trim(),
                    Mensaje: texto,
                    Situacion: selEstado.value,
                })
                if (!resultado.ok) {
                    console.error("Error al actualizar mensaje:", resultado.error)
                    return notifyError("No se pudo actualizar el mensaje")
                }
                notifySuccess("Mensaje actualizado")
            } else {
                const idCliente = Number(selCliente.value)
                if (!idCliente) return notifyWarning("Selecciona un cliente")
                const resultado = await messageService.crearMensajeManual({
                    ID_Cliente: idCliente,
                    Asunto: inAsunto.value.trim(),
                    Mensaje: texto,
                    USUCRE: usucre,
                })
                if (!resultado.ok) {
                    console.error("Error al crear mensaje:", resultado.error)
                    return notifyError(resultado.error?.message || "No se pudo crear el mensaje")
                }
                notifySuccess("Mensaje creado")
            }
        } finally {
            btnGuardar.disabled = false
        }

        cerrarModal(modal)
        await recargar()
    }

    async function eliminar(id) {
        const mensaje = mensajes.find(m => String(m.ID_Mensaje) === String(id))
        if (!mensaje) return
        confirmarBorrado({
            titulo: "Eliminar mensaje",
            cuerpo: `<p>Se eliminara el mensaje <strong>#${id}</strong>${mensaje.Asunto ? ` ("${escaparHTML(mensaje.Asunto)}")` : ""}.</p>
                     <p class="modal-nota modal-nota--peligro">Borrado fisico, no se puede deshacer.</p>`,
            onConfirm: async () => {
                const resultado = await messageService.eliminarMensaje(id)
                if (!resultado.ok) {
                    console.error("Error al eliminar mensaje:", resultado.error)
                    return notifyError("No se pudo eliminar el mensaje")
                }
                notifySuccess("Mensaje eliminado")
                await recargar()
            },
        })
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

    tbody.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        if (btn.dataset.accion === "editar") abrirEdicion(btn.dataset.id)
        else if (btn.dataset.accion === "eliminar") eliminar(btn.dataset.id)
    })

    const btnNuevo = contenedor.querySelector("#mensajes-nuevo")
    if (btnNuevo && puedeCrear) btnNuevo.addEventListener("click", abrirNuevo)

    modal.querySelector("#mensajes-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    btnGuardar.addEventListener("click", guardar)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    const cleanup = cerrarConEscape(modal)
    pintarTabla()

    return cleanup
}

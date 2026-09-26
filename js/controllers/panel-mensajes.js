import { guardRol } from "../session/roleGuard.js"
import { messageService } from "../services/messageService.js"
import { Modal } from "../components/Modal.js"
import { notifyError, notifySuccess } from "../utils/notify.js"

let esAdmin = false

function datosCliente(mensaje) {
    const persona = mensaje?.CLIENTE?.[0]?.PERSONA?.[0]
    if (persona && (persona.Nombre || persona.Ap_Paterno || persona.EMAIL)) {
        return {
            nombre: [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim() || persona.EMAIL,
            email: persona.EMAIL || "-"
        }
    }
    return { nombre: "-", email: "-" }
}

function crearFila(mensaje) {
    const cliente = datosCliente(mensaje)
    const botonEliminar = esAdmin ? `
        <td class="icon trash">
            <button class="btn-delete" data-id="${mensaje.ID_Mensaje}">
                <svg class="trash" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </td>
    ` : ""

    return `
        <tr>
            <td>${mensaje.ID_Mensaje}</td>
            <td>${cliente.nombre}</td>
            <td>${cliente.email}</td>
            <td class="mensaje-cell">
                ${mensaje.Mensaje || ""}
            </td>
            ${botonEliminar}
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("mensajes-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(mensaje => crearFila(mensaje)).join("")

    tbody.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            deleteMensaje(btn.dataset.id)
        })
    })
}

async function iniciarPanel() {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return
    esAdmin = roles.includes("ADMINISTRADOR")
    try {
        const resultado = await messageService.listarTodos()
        if (!resultado.ok) {
            console.error("Error al cargar mensajes:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar mensajes:", error)
    }
}

const cuerpoConfirmacion = document.createElement("div")
cuerpoConfirmacion.innerHTML = `
    <p>¿Estás seguro de que deseas eliminar este mensaje?</p>
    <div class="product-info">
        <span id="mensajeNombre"></span>
        <span id="mensajeCorreo"></span>
    </div>
    <p class="warning-text">Esta acción no se puede deshacer.</p>
`

const deleteModal = new Modal({
    title: "Confirmar eliminación",
    actions: [
        { label: "Cancelar", className: "cancel-btn", onClick: () => { pendingDelete = null; deleteModal.close() } },
        { label: "Eliminar", className: "delete-btn", onClick: () => {
            if (pendingDelete) {
                executeDelete(pendingDelete)
                pendingDelete = null
            }
        } }
    ]
})
deleteModal.setBody(cuerpoConfirmacion)

const mensajeNombre = cuerpoConfirmacion.querySelector("#mensajeNombre")
const mensajeCorreo = cuerpoConfirmacion.querySelector("#mensajeCorreo")

let pendingDelete = null

async function deleteMensaje(id) {
    const resultado = await messageService.listarTodos()
    if (!resultado.ok) return
    const mensaje = resultado.data.find(m => String(m.ID_Mensaje) === String(id))
    if (!mensaje) return

    const cliente = datosCliente(mensaje)
    mensajeNombre.textContent = cliente.nombre === "-" ? "Mensaje #" + id : cliente.nombre
    mensajeCorreo.textContent = cliente.email
    pendingDelete = id
    deleteModal.open()
}

async function executeDelete(id) {
    try {
        const resultado = await messageService.eliminarMensaje(id)
        if (!resultado.ok) {
            console.error("Error al eliminar mensaje:", resultado.error)
            notifyError("Error al eliminar el mensaje")
            return
        }
        notifySuccess("Mensaje eliminado correctamente")
        iniciarPanel()
    } catch (error) {
        console.error("Error al eliminar mensaje:", error)
        notifyError("Error al eliminar el mensaje")
    }
}

iniciarPanel()
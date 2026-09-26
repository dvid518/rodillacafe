import { guardRol } from "../session/roleGuard.js"
import { reservationService } from "../services/reservationService.js"
import { Modal } from "../components/Modal.js"
import { notifyError, notifySuccess } from "../utils/notify.js"

let esAdmin = false

function datosCliente(reserva) {
    const persona = reserva?.CLIENTE?.[0]?.PERSONA?.[0]
    if (persona && (persona.Nombre || persona.Ap_Paterno || persona.EMAIL)) {
        return {
            nombre: [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim() || persona.EMAIL,
            email: persona.EMAIL || "-"
        }
    }
    return { nombre: "-", email: "-" }
}

function formatearFecha(iso) {
    if (!iso) return "-"
    return new Date(iso).toLocaleDateString("es-PE")
}

function formatearHora(iso) {
    if (!iso) return "-"
    return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
}

function crearFila(reserva) {
    const cliente = datosCliente(reserva)
    const botonEliminar = esAdmin ? `
        <td class="icon trash">
            <button class="btn-delete" data-id="${reserva.ID_Reserva}">
                <svg class="trash" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </td>
    ` : ""

    return `
        <tr>
            <td>${reserva.ID_Reserva}</td>
            <td>${cliente.nombre}</td>
            <td>${cliente.email}</td>
            <td>${formatearFecha(reserva.F_Reserva)}</td>
            <td>${formatearHora(reserva.F_Reserva)}</td>
            <td>${reserva.N_Comensales}</td>
            ${botonEliminar}
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("reservas-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(reserva => crearFila(reserva)).join("")
    tbody.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            deleteReserva(btn.dataset.id)
        })
    })
}

async function iniciarPanel() {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return
    esAdmin = roles.includes("ADMINISTRADOR")
    try {
        const resultado = await reservationService.listarTodas()
        if (!resultado.ok) {
            console.error("Error al cargar reservas:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar reservas:", error)
    }
}

const cuerpoConfirmacion = document.createElement("div")
cuerpoConfirmacion.innerHTML = `
    <p>¿Estás seguro de que deseas eliminar esta reserva?</p>
    <div class="product-info">
        <span id="reservaNombre"></span>
        <span id="reservaFecha"></span>
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

const reservaNombre = cuerpoConfirmacion.querySelector("#reservaNombre")
const reservaFecha = cuerpoConfirmacion.querySelector("#reservaFecha")

let pendingDelete = null

async function deleteReserva(id) {
    const resultado = await reservationService.listarTodas()
    if (!resultado.ok) return
    const reserva = resultado.data.find(r => String(r.ID_Reserva) === String(id))
    if (!reserva) return

    const cliente = datosCliente(reserva)
    reservaNombre.textContent = cliente.nombre === "-" ? "Reserva #" + id : cliente.nombre
    reservaFecha.textContent = formatearFecha(reserva.F_Reserva) + " " + formatearHora(reserva.F_Reserva)
    pendingDelete = id
    deleteModal.open()
}

async function executeDelete(id) {
    try {
        const resultado = await reservationService.eliminarReserva(id)
        if (!resultado.ok) {
            console.error("Error al eliminar reserva:", resultado.error)
            notifyError("Error al eliminar la reserva")
            return
        }
        notifySuccess("Reserva eliminada correctamente")
        iniciarPanel()
    } catch (error) {
        console.error("Error al eliminar reserva:", error)
        notifyError("Error al eliminar la reserva")
    }
}

iniciarPanel()
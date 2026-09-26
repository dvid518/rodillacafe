import { opcionalSesion } from "../session/opcionalSesion.js"
import { authService } from "../services/authService.js"
import { messageService } from "../services/messageService.js"
import { notifySuccess, notifyError, notifyWarning } from "../utils/notify.js"

let inputNombre
let inputEmail
let inputMensaje
let checkbox
let formulario

document.addEventListener("DOMContentLoaded", async () => {
    inputNombre = document.getElementById("nombre")
    inputEmail = document.getElementById("mail")
    inputMensaje = document.getElementById("mensaje")
    checkbox = document.getElementById("checkbox")
    formulario = document.querySelector("form")

    await opcionalSesion()
    cargarPerfil()

    formulario.addEventListener("submit", enviarMensaje)
})

async function cargarPerfil() {
    const perfil = await authService.obtenerPerfil()
    if (perfil.ok) {
        if (inputNombre) inputNombre.value = perfil.data.nombre || ""
        if (!inputNombre.readOnly) inputNombre.setAttribute("readonly", "readonly")
        if (inputEmail) inputEmail.value = perfil.data.email || ""
        if (!inputEmail.readOnly) inputEmail.setAttribute("readonly", "readonly")
    }
}

function validateMensaje() {
    if (!inputMensaje.value.trim()) {
        notifyWarning("Ingrese un mensaje")
        return false
    }
    if (!checkbox.checked) {
        notifyWarning("Debe aceptar el tratamiento de información")
        return false
    }
    return true
}

async function enviarMensaje(e) {
    e.preventDefault()
    if (!validateMensaje()) return
    const sesion = await opcionalSesion()
    if (sesion === null) {
        notifyWarning("Inicia sesión para enviar un mensaje", 3500)
        setTimeout(() => {
            window.location.href = "/login.html?redirect=/contacto.html"
        }, 1500)
        return
    }
    try {
        const resultado = await messageService.enviarMensaje({ Mensaje: inputMensaje.value.trim() })
        if (!resultado.ok) {
            console.error("Error guardando mensaje:", resultado.error)
            notifyError("No se pudo enviar el mensaje")
            return
        }
        notifySuccess("Mensaje enviado correctamente")
        formulario.reset()
    } catch (error) {
        console.error("Error guardando mensaje:", error)
        notifyError("No se pudo enviar el mensaje")
    }
}
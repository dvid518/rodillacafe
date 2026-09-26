import { opcionalSesion } from "../session/opcionalSesion.js"
import { authService } from "../services/authService.js"
import { reservationService } from "../services/reservationService.js"
import { notifySuccess, notifyError, notifyWarning } from "../utils/notify.js"

let inputPersonas
let inputFecha
let inputHora
let inputNombre
let inputEmail
let pasoActual = 0
let personas = null
let nombre = ""
let email = ""
let fecha = ""
let hora = ""

const pasos = [
    "paso-personas",
    "paso-fecha",
    "paso-hora",
    "paso-datos",
    "paso-confirmacion"
]

document.addEventListener("DOMContentLoaded", async () => {
    inputPersonas = document.querySelector(".personas input")
    inputFecha = document.getElementById("fecha")
    inputHora = document.getElementById("hora")
    inputNombre = document.getElementById("nombre")
    inputEmail = document.getElementById("email")

    await opcionalSesion()

    document.querySelectorAll(".personas button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".personas button").forEach(b => b.classList.remove("active"))
            inputPersonas.classList.remove("active")
            inputPersonas.value = ""
            btn.classList.add("active")
            personas = btn.textContent
        })
    })

    inputPersonas.addEventListener("input", e => {
        document.querySelectorAll(".personas button").forEach(b => b.classList.remove("active"))
        const valor = e.target.value.trim()
        if (valor) {
            inputPersonas.classList.add("active")
            personas = valor
        } else {
            inputPersonas.classList.remove("active")
            personas = null
        }
    })
    inputFecha.addEventListener("input", e => { fecha = e.target.value })
    inputFecha.addEventListener("change", e => { fecha = e.target.value })
    inputHora.addEventListener("input", e => { hora = e.target.value })
    inputHora.addEventListener("change", e => { hora = e.target.value })

    cargarPerfil()
    showPaso(0)
})

async function cargarPerfil() {
    const perfil = await authService.obtenerPerfil()
    if (perfil.ok) {
        nombre = perfil.data.nombre || ""
        email = perfil.data.email || ""
        if (inputNombre) inputNombre.value = nombre
        if (inputEmail) inputEmail.value = email
    }
}

function showPaso(index) {
    pasoActual = index
    pasos.forEach((id, i) => {
        const seccion = document.getElementById(id)
        if (seccion) {
            seccion.classList.toggle("activo", i === index)
        }
    })
    updateFases(index)
}

function updateFases(index) {
    document.querySelectorAll(".fase").forEach((fase, i) => { fase.classList.toggle("act", i === index) })
}

function nextPaso() {
    if (pasoActual < pasos.length - 1) {
        pasoActual++
        if (pasoActual === 4) {
            fillResumen()
        }
        showPaso(pasoActual)
    }
}

function validateDato(pasoActual) {
    switch (pasoActual) {
        case 0:
            if (!personas) {
                notifyWarning("Selecciona la cantidad de personas")
                return false
            }
            if (Number(personas) > 10) {
                notifyWarning("Máximo 10 personas")
                return false
            }
            break
        case 1:
            if (!inputFecha.value) {
                notifyWarning("Selecciona una fecha")
                return false
            }
            fecha = inputFecha.value
            break
        case 2:
            if (!inputHora.value) {
                notifyWarning("Selecciona una hora")
                return false
            }
            hora = inputHora.value
            break
        case 3:
            if (!nombre) {
                notifyWarning("Debes iniciar sesión con tu cuenta")
                return false
            }
            break
    }
    return true
}

document.querySelectorAll("[name='continuar']").forEach(btn => {
    btn.addEventListener("click", handleContinuar)
})

function handleContinuar() {
    if (!validateDato(pasoActual)) return
    nextPaso()
}

function fillResumen() {
    document.getElementById("res-nombre").textContent = nombre
    document.getElementById("res-email").textContent = email
    document.getElementById("res-fecha").textContent = fecha
    document.getElementById("res-hora").textContent = hora
    document.getElementById("res-personas").textContent = personas
}

async function confirmReserva() {
    if (!nombre || !fecha || !hora || !personas) {
        notifyWarning("Completa todos los datos de la reserva")
        return
    }
    const sesion = await opcionalSesion()
    if (sesion === null) {
        notifyWarning("Inicia sesión para confirmar la reserva", 3500)
        setTimeout(() => {
            window.location.href = "/login.html?redirect=/reserva.html"
        }, 1500)
        return
    }
    const fechaIso = new Date(`${fecha}T${hora}:00-05:00`).toISOString()
    try {
        const resultado = await reservationService.crearReserva({
            N_Comensales: Number(personas),
            F_Reserva: fechaIso,
            Observacion: null
        })
        if (!resultado.ok) {
            console.error("Error guardando reserva:", resultado.error)
            notifyError("No se pudo guardar la reserva")
            return
        }
        notifySuccess("Reserva confirmada correctamente", 2500)
        setTimeout(() => {
            window.location.href = "/mis-reservas.html"
        }, 1200)
    } catch (error) {
        console.error("Error guardando reserva:", error)
        notifyError("No se pudo guardar la reserva")
    }
}

function editReserva() {
    showPaso(0)
}

document.getElementById("btn-confirmar")?.addEventListener("click", confirmReserva)
document.getElementById("btn-editar")?.addEventListener("click", editReserva)
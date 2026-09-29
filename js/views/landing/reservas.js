import { reservationService } from "../../services/reservationService.js"
import { opcionalSesion } from "../../session/opcionalSesion.js"
import { notifyWarning, notifySuccess, notifyError } from "../../utils/notify.js"

/* ==========================================================================
   VISTA RESERVAS — formulario por pasos
   --------------------------------------------------------------------------
   El controller devuelve la funcion de limpieza: el router la ejecuta al
   navegar a otra vista, y asi los listeners de estos botones no se acumulan
   ni el <select> de horas se duplica en cada ida y vuelta.
   ========================================================================== */

const HORAS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"]
const PERSONAS = [1, 2, 3, 4, 5, 6]

export async function reservasController(contenedor) {
    const pasos = Array.from(contenedor.querySelectorAll(".paso"))
    const indicadores = Array.from(contenedor.querySelectorAll(".paso__indicador"))
    const selectorPersonas = contenedor.querySelector("#personas-selector")
    const inputFecha = contenedor.querySelector("#reserva-fecha")
    const selectHora = contenedor.querySelector("#reserva-hora")
    const resumen = contenedor.querySelector("#reserva-resumen")
    const botonConfirmar = contenedor.querySelector("#reserva-confirmar")

    if (!pasos.length || !selectorPersonas || !inputFecha || !selectHora) return

    let paso = 0
    let personas = 2
    let fecha = ""
    let hora = ""

    // --- selector de personas ---
    const botonesPersona = new Map()
    for (const n of PERSONAS) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "persona-boton"
        btn.textContent = String(n)
        btn.setAttribute("aria-pressed", n === personas ? "true" : "false")
        if (n === personas) btn.classList.add("persona-boton--activo")
        botonesPersona.set(n, btn)
        selectorPersonas.appendChild(btn)
    }

    const onPersona = evento => {
        const btn = evento.target.closest(".persona-boton")
        if (!btn || !selectorPersonas.contains(btn)) return
        personas = Number(btn.textContent)
        for (const [n, nodo] of botonesPersona) {
            const activo = n === personas
            nodo.classList.toggle("persona-boton--activo", activo)
            nodo.setAttribute("aria-pressed", activo ? "true" : "false")
        }
    }
    selectorPersonas.addEventListener("click", onPersona)

    // --- selector de hora ---
    for (const h of HORAS) {
        const opt = document.createElement("option")
        opt.value = h
        opt.textContent = h
        selectHora.appendChild(opt)
    }

    // la fecha no puede ser pasado
    const hoy = new Date()
    const isoLocal = d => d.toISOString().slice(0, 10)
    inputFecha.min = isoLocal(hoy)
    inputFecha.value = isoLocal(hoy)
    fecha = inputFecha.value

    // --- navegacion entre pasos ---
    function pintarResumen() {
        resumen.replaceChildren()
        const filas = [
            ["Personas", String(personas)],
            ["Fecha", fecha ? new Date(`${fecha}T12:00:00`).toLocaleDateString("es-PE") : "—"],
            ["Hora", hora || selectHora.value || "—"],
        ]
        for (const [clave, valor] of filas) {
            const dt = document.createElement("dt")
            dt.textContent = clave
            const dd = document.createElement("dd")
            dd.textContent = valor
            resumen.append(dt, dd)
        }
    }

    function mostrarPaso(i) {
        paso = Math.max(0, Math.min(i, pasos.length - 1))
        pasos.forEach((p, idx) => {
            const activo = idx === paso
            p.classList.toggle("paso--activo", activo)
            if (activo) p.removeAttribute("hidden")
            else p.setAttribute("hidden", "")
        })
        indicadores.forEach((ind, idx) => {
            ind.classList.toggle("paso__indicador--activo", idx === paso)
            ind.classList.toggle("paso__indicador--hecho", idx < paso)
        })
        if (paso === pasos.length - 1) pintarResumen()
    }

    const onSiguiente = evento => {
        const btn = evento.target.closest("[data-siguiente]")
        if (!btn || !contenedor.contains(btn)) return

        if (pasos[paso].dataset.paso === "fecha") {
            if (!inputFecha.value) return notifyWarning("Selecciona una fecha")
            fecha = inputFecha.value
        }
        if (pasos[paso].dataset.paso === "hora") {
            if (!selectHora.value) return notifyWarning("Selecciona una hora")
            hora = selectHora.value
        }
        mostrarPaso(paso + 1)
    }
    const onVolver = evento => {
        if (!evento.target.closest("[data-volver]")) return
        mostrarPaso(paso - 1)
    }
    contenedor.addEventListener("click", onSiguiente)
    contenedor.addEventListener("click", onVolver)

    // --- confirmar ---
    const onConfirmar = async () => {
        const sesion = await opcionalSesion()
        if (!sesion) {
            notifyWarning("Inicia sesión para confirmar tu reserva")
            setTimeout(() => { window.location.href = "/auth.html#/login" }, 1500)
            return
        }
        if (!fecha) fecha = inputFecha.value
        if (!hora) hora = selectHora.value

        botonConfirmar.disabled = true
        const resultado = await reservationService.crearReserva({
            N_Comensales: Number(personas),
            F_Reserva: `${fecha}T${hora}:00`,
        })
        botonConfirmar.disabled = false

        if (!resultado.ok) {
            console.error(resultado.error)
            return notifyError("No se pudo crear la reserva")
        }
        notifySuccess("Reserva confirmada")
        mostrarPaso(0)
    }
    botonConfirmar.addEventListener("click", onConfirmar)

    mostrarPaso(0)

    // el router ejecuta esto al salir de la vista
    return () => {
        selectorPersonas.removeEventListener("click", onPersona)
        contenedor.removeEventListener("click", onSiguiente)
        contenedor.removeEventListener("click", onVolver)
        botonConfirmar.removeEventListener("click", onConfirmar)
    }
}

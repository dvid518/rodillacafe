import { messageService } from "../../services/messageService.js"
import { authService } from "../../services/authService.js"
import { opcionalSesion } from "../../session/opcionalSesion.js"
import { notifyWarning, notifySuccess, notifyError } from "../../utils/notify.js"

/* ==========================================================================
   VISTA CONTACTO
   --------------------------------------------------------------------------
   Los campos de nombre y correo van en readonly a proposito: el mensaje se
   guarda contra el CLIENTE de la sesion, no contra lo que se escriba a mano.
   Asi el remitente no se puede suplantar desde el formulario.
   ========================================================================== */

export async function contactoController(contenedor) {
    const form = contenedor.querySelector("#contacto-form")
    if (!form) return

    const inputNombre = contenedor.querySelector("#contacto-nombre")
    const inputEmail = contenedor.querySelector("#contacto-email")
    const textarea = contenedor.querySelector("#contacto-mensaje")
    const checkbox = contenedor.querySelector("#contacto-acepto")
    const aviso = contenedor.querySelector("#contacto-aviso")
    const boton = form.querySelector('button[type="submit"]')

    const sesion = await opcionalSesion()

    if (sesion) {
        const perfil = await authService.obtenerPerfil()
        if (perfil.ok && perfil.data) {
            inputNombre.value = perfil.data.nombre || ""
            inputEmail.value = perfil.data.email || ""
        }
    } else {
        aviso.textContent = "Inicia sesión para enviar un mensaje."
        aviso.classList.add("contacto__aviso--aviso")
    }

    const onSubmit = async evento => {
        evento.preventDefault()

        if (!textarea.value.trim()) {
            return notifyWarning("Escribe un mensaje")
        }
        if (!checkbox.checked) {
            return notifyWarning("Acepta el tratamiento de datos")
        }

        const actual = await opcionalSesion()
        if (!actual) {
            notifyWarning("Inicia sesión para enviar")
            setTimeout(() => { window.location.href = "/auth.html#/login" }, 1500)
            return
        }

        boton.disabled = true
        const resultado = await messageService.enviarMensaje({ Mensaje: textarea.value.trim() })
        boton.disabled = false

        if (!resultado.ok) {
            console.error(resultado.error)
            return notifyError("No se pudo enviar el mensaje")
        }
        notifySuccess("Mensaje enviado. Te responderemos pronto.")
        form.reset()
        if (sesion) {
            const perfil = await authService.obtenerPerfil()
            if (perfil.ok && perfil.data) {
                inputNombre.value = perfil.data.nombre || ""
                inputEmail.value = perfil.data.email || ""
            }
        }
    }
    form.addEventListener("submit", onSubmit)

    return () => form.removeEventListener("submit", onSubmit)
}

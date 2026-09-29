import { authService } from "../../services/authService.js"
import { Loading } from "../../components/Loading.js"
import { notifySuccess } from "../../utils/notify.js"

export async function registerController(contenedor) {
    const form = contenedor.querySelector("#register-form")
    const inputNombre = contenedor.querySelector("#register-nombre")
    const inputEmail = contenedor.querySelector("#register-email")
    const inputPassword = contenedor.querySelector("#register-password")
    const inputConfirm = contenedor.querySelector("#register-confirm")
    const errorEl = contenedor.querySelector("#register-error")
    const boton = contenedor.querySelector("#register-enviar")
    const loading = new Loading({ mensaje: "Creando tu cuenta..." })

    const textoBoton = boton.textContent

    function mostrarError(mensaje) {
        errorEl.textContent = mensaje
        errorEl.classList.add("auth-form__error--visible")
    }

    function limpiarError() {
        errorEl.textContent = ""
        errorEl.classList.remove("auth-form__error--visible")
    }

    function ocupado(mensaje) {
        boton.disabled = true
        boton.textContent = mensaje
    }

    function libre() {
        boton.disabled = false
        boton.textContent = textoBoton
    }

    /* si el alta falla se pone foco en el primer campo con problema, que si
       no el usuario lee el error sin saber que tocar */
    const onSubmit = async e => {
        e.preventDefault()
        limpiarError()

        const nombre = inputNombre.value.trim()
        const email = inputEmail.value.trim()
        const password = inputPassword.value
        const confirm = inputConfirm.value

        if (!nombre) {
            mostrarError("Ingresa tu nombre")
            return inputNombre.focus()
        }
        if (!email || !email.includes("@")) {
            mostrarError("Correo inválido")
            return inputEmail.focus()
        }
        if (password.length < 6) {
            mostrarError("La contraseña debe tener al menos 6 caracteres")
            return inputPassword.focus()
        }
        if (password !== confirm) {
            mostrarError("Las contraseñas no coinciden")
            return inputConfirm.focus()
        }

        ocupado("Creando tu cuenta...")
        loading.show()
        const resultado = await authService.registro(nombre, email, password)
        loading.hide()
        libre()

        if (!resultado.ok) {
            return mostrarError(resultado.error?.message || "No se pudo crear la cuenta")
        }

        notifySuccess("Cuenta creada. Inicia sesión.", 3000)
        window.location.hash = "/login"
    }

    form.addEventListener("submit", onSubmit)
    inputNombre.focus()

    return () => form.removeEventListener("submit", onSubmit)
}

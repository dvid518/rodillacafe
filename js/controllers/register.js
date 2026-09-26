import { authService } from "../services/authService.js"
import { Loading } from "../components/Loading.js"
import { notifySuccess } from "../utils/notify.js"

function backLogin() {
    window.location.href = "/login.html"
}

function mensajeErrorRegistro(error) {
    const msg = (error && error.message) || ""
    if (/database|duplicate|23505|row.?level|permission/i.test(msg)) {
        return "No se pudo crear la cuenta. Verifica tus datos e inténtalo de nuevo."
    }
    return msg
}

const loading = new Loading({ mensaje: "Creando tu cuenta" })

async function registrar() {
    const inputNombre = document.getElementById("nombre").value
    const inputUser = document.getElementById("user").value
    const inputPass = document.getElementById("pass").value
    const inputConfirm = document.getElementById("confirm").value

    const error = document.getElementById("msg")

    if (!inputNombre.trim()) {
        error.classList.add("act")
        error.textContent = "*Ingrese su nombre"
        return
    }
    if (!inputUser.trim() || !inputUser.includes("@")) {
        error.classList.add("act")
        error.textContent = "*Ingrese un correo válido"
        return
    }
    if (inputPass.length < 6) {
        error.classList.add("act")
        error.textContent = "*La contraseña debe tener al menos 6 caracteres"
        return
    }
    if (inputPass !== inputConfirm) {
        error.classList.add("act")
        error.textContent = "*Las contraseñas no coinciden"
        return
    }
    error.classList.remove("act")
    loading.show()

    const resultado = await authService.registro(inputNombre.trim(), inputUser.trim(), inputPass)
    if (!resultado.ok) {
        loading.hide()
        error.classList.add("act")
        error.textContent = "*" + mensajeErrorRegistro(resultado.error)
        return
    }

    loading.hide()
    notifySuccess("Cuenta creada correctamente. Ahora puede iniciar sesión.", 4000)
    setTimeout(() => {
        window.location.href = "/login.html"
    }, 1500)
}

document.getElementById("btn-volver")?.addEventListener("click", backLogin)
document.getElementById("btn-registrar")?.addEventListener("click", registrar)

document.getElementById("confirm").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        registrar()
    }
})
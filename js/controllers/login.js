import { authService } from "../services/authService.js"
import { Loading } from "../components/Loading.js"

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function backIndex() {
    window.location.href = "/"
}

const loading = new Loading({ mensaje: "Bienvenido a Rodilla" })

async function login() {
    const inputUser = document.getElementById("user").value
    const inputPass = document.getElementById("pass").value

    const error = document.getElementById("msg")

    if (!inputUser.trim() || !inputPass) {
        error.classList.add("act")
        error.textContent = "*Ingrese sus datos"
        return
    }
    error.classList.remove("act")
    loading.show()

    const resultado = await authService.login(inputUser.trim(), inputPass)
    if (!resultado.ok) {
        loading.hide()
        error.classList.add("act")
        error.textContent = "*" + (resultado.error.message || "Datos incorrectos")
        return
    }

    const rolesResult = await authService.obtenerRoles()
    const esEmpleado = rolesResult.ok && rolesResult.data.some(r => r === "ADMINISTRADOR" || r === "CAJERO" || r === "MOZO")

    const params = new URLSearchParams(window.location.search)
    const redirect = params.get("redirect")

    await esperar(1500)
    if (redirect && redirect.startsWith("/")) {
        window.location.href = redirect
        return
    }
    window.location.href = esEmpleado ? "/admin/panel-carta.html" : "/"
}

document.getElementById("btn-volver")?.addEventListener("click", backIndex)
document.getElementById("btn-login")?.addEventListener("click", login)

document.getElementById("pass").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        login()
    }
})
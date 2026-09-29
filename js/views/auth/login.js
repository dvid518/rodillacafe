import { authService } from "../../services/authService.js"
import { Loading } from "../../components/Loading.js"

const ROLES_EMPLEADO = ["ADMINISTRADOR", "CAJERO", "MOZO"]

/**
 * Solo se admite un destino interno. La comprobacion `startsWith("/")` del
 * enunciado deja pasar "//evil.com", que el navegador resuelve como URL
 * protocol-relativa y saca al usuario del sitio: es un redirect abierto.
 * El segundo "/" es justo lo que distingue una ruta de un host.
 */
function destinoSeguro(valor) {
    if (!valor) return null
    if (!valor.startsWith("/")) return null
    if (valor.startsWith("//")) return null
    if (valor.includes("\\")) return null
    return valor
}

/**
 * El redirect se busca en los dos sitios posibles: session/guard.js lo pone
 * en el query (/?redirect=...) porque escribe la URL antes de que exista el
 * hash, y alguien puede escribirlo a mano como #/login?redirect=...
 */
function leerRedirect() {
    const delQuery = new URLSearchParams(window.location.search).get("redirect")
    if (delQuery) return destinoSeguro(delQuery)

    const delHash = window.location.hash.split("?")[1] || ""
    return destinoSeguro(new URLSearchParams(delHash).get("redirect"))
}

export async function loginController(contenedor) {
    const form = contenedor.querySelector("#login-form")
    const inputEmail = contenedor.querySelector("#login-email")
    const inputPassword = contenedor.querySelector("#login-password")
    const errorEl = contenedor.querySelector("#login-error")
    const boton = contenedor.querySelector("#login-enviar")
    const loading = new Loading({ mensaje: "Iniciando sesión..." })

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

    /* al entrar se vacian los campos: si la sesion no se crea, el formulario
       queda listo para reintentarlo sin tener que borralo a mano */
    const alEntrar = () => {
        inputEmail.value = ""
        inputPassword.value = ""
        limpiarError()
        inputEmail.focus()
    }

    const onSubmit = async e => {
        e.preventDefault()
        limpiarError()

        const email = inputEmail.value.trim()
        const password = inputPassword.value

        if (!email || !password) {
            return mostrarError("Ingresa tus credenciales")
        }
        if (!email.includes("@")) {
            return mostrarError("El correo no parece válido")
        }

        ocupado("Iniciando sesión...")
        loading.show()
        const resultado = await authService.login(email, password)
        loading.hide()

        if (!resultado.ok) {
            libre()
            return mostrarError(resultado.error?.message || "Credenciales incorrectas")
        }

        /* la sesion ya existe: si algo falla ahora, el boton se queda
           deshabilitado para no mandar al usuario a un bucle de recargas */
        const roles = await authService.obtenerRoles()
        const lista = roles.ok && Array.isArray(roles.data) ? roles.data : []
        const esEmpleado = lista.some(r => ROLES_EMPLEADO.includes(r))

        const redirect = leerRedirect()
        window.location.href = redirect || (esEmpleado ? "/dashboard.html#/dashboard" : "/index.html")
    }

    form.addEventListener("submit", onSubmit)
    alEntrar()

    return () => form.removeEventListener("submit", onSubmit)
}

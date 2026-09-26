import "./../session/guard.js"
import { guardRol } from "../session/roleGuard.js"
import { userService } from "../services/userService.js"
import { Modal } from "../components/Modal.js"
import { notifyError, notifySuccess } from "../utils/notify.js"

function rolesDeUsuario(usuario) {
    const roles = (usuario.USUARIO_ROL || []).map(ur => ur.ROL?.[0]?.N_Rol || ur.ROL?.N_Rol).filter(Boolean)
    return roles.length ? roles.join(", ") : "-"
}

function esAdminUsuario(usuario) {
    return (usuario.USUARIO_ROL || []).some(ur =>
        (ur.ROL?.[0]?.N_Rol || ur.ROL?.N_Rol) === "ADMINISTRADOR"
    )
}

function datosPersona(usuario) {
    const persona = usuario?.CLIENTE?.[0]?.PERSONA?.[0]
    if (persona) {
        return {
            nombre: [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim() || "-",
            email: persona.EMAIL || "-"
        }
    }
    return { nombre: "-", email: "-" }
}

function crearFila(usuario) {
    const persona = datosPersona(usuario)
    const rolLabel = rolesDeUsuario(usuario)
    const esAdmin = esAdminUsuario(usuario)

    const botonPromover = esAdmin
        ? "-"
        : `<button class="btn-view" data-id="${usuario.ID_Usuario}">Promover</button>`

    return `
        <tr>
            <td>${usuario.ID_Usuario}</td>
            <td>${usuario.Logeo || "-"}</td>
            <td>${persona.nombre}</td>
            <td>${persona.email}</td>
            <td>${rolLabel}</td>
            <td>${usuario.Bloqueado === "1" ? "Sí" : "No"}</td>
            <td class="icon">${botonPromover}</td>
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("usuarios-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(usuario => crearFila(usuario)).join("")

    tbody.querySelectorAll(".btn-view").forEach(btn => {
        btn.addEventListener("click", () => {
            iniciarPromocion(btn.dataset.id)
        })
    })
}

async function iniciarPanel() {
    const roles = await guardRol(["ADMINISTRADOR"])
    if (!roles) return
    try {
        const resultado = await userService.listarUsuarios()
        if (!resultado.ok) {
            console.error("Error al cargar usuarios:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar usuarios:", error)
    }
}

const cuerpoPromocion = document.createElement("div")
cuerpoPromocion.innerHTML = `
    <p>¿Seguro que deseas promover a este usuario?</p>
    <div class="product-info">
        <span id="userLogeo"></span>
        <span id="userRol"></span>
    </div>
    <p class="warning-text">El usuario obtendrá acceso administrativo.</p>
`

const promoteModal = new Modal({
    title: "Promover a administrador",
    actions: [
        { label: "Cancelar", className: "cancel-btn", onClick: () => { pendingPromote = null; promoteModal.close() } },
        { label: "Promover", className: "delete-btn", onClick: () => {
            if (pendingPromote) {
                ejecutarPromocion(pendingPromote)
                pendingPromote = null
            }
        } }
    ]
})
promoteModal.setBody(cuerpoPromocion)

const userLogeo = cuerpoPromocion.querySelector("#userLogeo")
const userRol = cuerpoPromocion.querySelector("#userRol")

let pendingPromote = null

async function iniciarPromocion(id) {
    const resultado = await userService.listarUsuarios()
    if (!resultado.ok) return
    const usuario = resultado.data.find(u => String(u.ID_Usuario) === String(id))
    if (!usuario) return

    userLogeo.textContent = usuario.Logeo || "usuario " + id
    userRol.textContent = rolesDeUsuario(usuario)
    pendingPromote = usuario.Logeo
    promoteModal.open()
}

async function ejecutarPromocion(logeo) {
    try {
        const resultado = await userService.promoverAAdmin(logeo)
        if (!resultado.ok) {
            console.error("Error al promover:", resultado.error)
            notifyError("No se pudo promover al usuario")
            return
        }
        notifySuccess("Usuario promovido a administrador")
        iniciarPanel()
    } catch (error) {
        console.error("Error al promover:", error)
        notifyError("No se pudo promover al usuario")
    }
}

iniciarPanel()
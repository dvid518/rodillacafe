import { guardRol } from "../../session/roleGuard.js"
import { userService } from "../../services/userService.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"
import {
    abrirModal, cerrarModal, cerrarConEscape, filaVacia, filaError,
    rolesDe, confirmarBorrado,
} from "./crud-comun.js"

const CELDAS = 7

/**
 * Solo ADMINISTRADOR. No por la interfaz: RLS de USUARIO es
 * auth_id = auth.uid() or is_admin(), asi que un cajero recibiria una lista
 * vacia, y usp_PromoverAdmin vuelve a comprobar is_admin() por dentro.
 */
export async function usuariosController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR"])
    if (!roles) return

    const tbody = contenedor.querySelector("#usuarios-tbody")
    const modal = contenedor.querySelector("#usuarios-modal")
    const aviso = contenedor.querySelector("#usuarios-aviso")
    const info = modal.querySelector("#usuarios-modal-info")
    const selRol = modal.querySelector("#usuarios-input-rol")
    const btnGuardar = modal.querySelector("#usuarios-modal-guardar")

    let usuarios = []
    let editando = null

    const rUsuarios = await userService.listarUsuarios()
    usuarios = rUsuarios.ok ? rUsuarios.data : []

    if (!rUsuarios.ok) {
        aviso.hidden = false
        aviso.textContent = "No se pudo leer la lista de usuarios."
    }

    /* El unico rol asignable desde la aplicacion. Los demas se dejan fuera en
       vez de mostrarlos y fallar: usp_PromoverAdmin fija ADMINISTRADOR y
       revoca cualquier otro rol, asi que ofrecer CAJERO/MOZO seria mentir. */
    selRol.innerHTML = '<option value="ADMINISTRADOR">Administrador</option>'

    function nombreDe(usuario) {
        const persona = usuario.CLIENTE?.[0]?.PERSONA?.[0]
        if (!persona?.Nombre) return "—"
        return [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim()
    }

    function emailDe(usuario) {
        return usuario.CLIENTE?.[0]?.PERSONA?.[0]?.EMAIL || "—"
    }

    function pintarTabla() {
        if (!rUsuarios.ok) {
            tbody.innerHTML = filaError(CELDAS, "los usuarios")
            return
        }
        if (!usuarios.length) {
            tbody.innerHTML = filaVacia(CELDAS, "No hay usuarios registrados")
            return
        }

        tbody.innerHTML = usuarios.map(u => {
            const yaEsAdmin = rolesDe(u).includes("ADMINISTRADOR")
            const accion = yaEsAdmin
                ? '<span class="chip chip--neutro">Admin</span>'
                : '<button class="btn btn--sm btn--ghost" type="button" data-accion="promover" data-id="' + u.ID_Usuario + '">Promover</button>'
            return `
                <tr>
                    <td>${u.ID_Usuario}</td>
                    <td>${escaparHTML(u.Logeo || "—")}</td>
                    <td>${escaparHTML(nombreDe(u))}</td>
                    <td>${escaparHTML(emailDe(u))}</td>
                    <td>${escaparHTML(rolesDe(u))}</td>
                    <td>${u.Bloqueado === "1" ? '<span class="chip chip--estado-x">Sí</span>' : "No"}</td>
                    <td>${accion}</td>
                </tr>
            `
        }).join("")
    }

    function abrirPromover(id) {
        const usuario = usuarios.find(u => u.ID_Usuario === Number(id))
        if (!usuario) return
        editando = usuario
        const nombre = nombreDe(usuario)
        info.innerHTML = `Vas a promover a <strong>${escaparHTML(nombre === "—" ? (usuario.Logeo || `#${usuario.ID_Usuario}`) : nombre)}</strong>
                          (${escaparHTML(usuario.Logeo || "sin logeo")}). Su lista de roles passara a ser solo ADMINISTRADOR.`
        selRol.value = "ADMINISTRADOR"
        abrirModal(modal, btnGuardar)
    }

    async function promover() {
        if (!editando) return
        const email = editando.Logeo
        if (!email) {
            return notifyWarning("Este usuario no tiene Logeo, no hay correo con el que promoverlo")
        }

        btnGuardar.disabled = true
        const resultado = await userService.promoverAAdmin(email)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al promover usuario:", resultado.error)
            return notifyError("No se pudo promover al usuario")
        }

        notifySuccess(`${email} ahora es administrador`)
        cerrarModal(modal)
        editando = null
        await recargar()
    }

    async function recargar() {
        const r = await userService.listarUsuarios()
        if (r.ok) {
            usuarios = r.data
            pintarTabla()
        } else {
            console.error("Error al recargar usuarios:", r.error)
            notifyError("No se pudo actualizar la lista")
        }
    }

    tbody.addEventListener("click", e => {
        const btn = e.target.closest('[data-accion="promover"]')
        if (!btn) return
        // se pide confirmacion aparte: es una accion que no tiene vuelta atras
        const usuario = usuarios.find(u => u.ID_Usuario === Number(btn.dataset.id))
        if (!usuario) return
        confirmarBorrado({
            titulo: "Promover a administrador",
            cuerpo: `<p>${escaparHTML(usuario.Logeo || `#${usuario.ID_Usuario}`)} pasara a ser ADMINISTRADOR
                     y perdera sus roles actuales (${escaparHTML(rolesDe(usuario))}).</p>
                     <p class="modal-nota">Tendria que volver a asignar el resto de roles desde la base de datos.</p>`,
            textoBoton: "Promover",
            onConfirm: async () => {
                const resultado = await userService.promoverAAdmin(usuario.Logeo)
                if (!resultado.ok) {
                    console.error("Error al promover usuario:", resultado.error)
                    return notifyError("No se pudo promover al usuario")
                }
                notifySuccess(`${usuario.Logeo} ahora es administrador`)
                await recargar()
            },
        })
    })

    modal.querySelector("#usuarios-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    btnGuardar.addEventListener("click", promover)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    const cleanup = cerrarConEscape(modal)
    pintarTabla()

    return cleanup
}

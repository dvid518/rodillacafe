import { guardRol } from "../../session/roleGuard.js"
import { userService } from "../../services/userService.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"
import {
    abrirModal, cerrarModal, cerrarConEscape, filaVacia, filaError,
    rolesDe, nombreUsuario, confirmarBorrado,
} from "./crud-comun.js"

/* La columna "Logeo" salio de la tabla y de los modales: es el identificador
   alfanumerico de la cuenta. Sigue estando en USUARIO — es lo que se le pasa a
   usp_PromoverAdmin(p_email) — pero no se pinta. Quien entra se reconoce por
   el nombre de la persona. */
const CELDAS = 6

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

    /* Cliente para los clientes, EMPLEADO para el personal: el personal no tiene
       CLIENTE, asi que sin el segundo embedding el admin seria invisible en su
       propia lista. */
    function nombreDe(usuario) {
        return nombreUsuario(usuario)
    }

    function emailDe(usuario) {
        const persona = usuario.CLIENTE?.[0]?.PERSONA?.[0] || usuario.EMPLEADO?.[0]?.PERSONA?.[0]
        return persona?.EMAIL || "—"
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
        info.innerHTML = `Vas a promover a <strong>${escaparHTML(nombre)}</strong>.
                          Su lista de roles passara a ser solo ADMINISTRADOR.`
        selRol.value = "ADMINISTRADOR"
        abrirModal(modal, btnGuardar)
    }

    async function promover() {
        if (!editando) return
        // el Logeo es el correo con el que la cuenta se creo: se usa para
        // llamar a usp_PromoverAdmin y no se muestra
        const email = editando.Logeo
        if (!email) {
            return notifyWarning("Esta cuenta no tiene correo registrado, no se puede promover")
        }

        btnGuardar.disabled = true
        const resultado = await userService.promoverAAdmin(email)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al promover usuario:", resultado.error)
            return notifyError("No se pudo promover al usuario")
        }

        notifySuccess(`${nombreDe(editando)} ahora es administrador`)
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
            cuerpo: `<p>${escaparHTML(nombreDe(usuario))} pasara a ser ADMINISTRADOR
                     y perdera sus roles actuales (${escaparHTML(rolesDe(usuario))}).</p>
                     <p class="modal-nota">Tendria que volver a asignar el resto de roles desde la base de datos.</p>`,
            textoBoton: "Promover",
            onConfirm: async () => {
                if (!usuario.Logeo) return notifyWarning("Esta cuenta no tiene correo registrado")
                const resultado = await userService.promoverAAdmin(usuario.Logeo)
                if (!resultado.ok) {
                    console.error("Error al promover usuario:", resultado.error)
                    return notifyError("No se pudo promover al usuario")
                }
                notifySuccess(`${nombreDe(usuario)} ahora es administrador`)
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

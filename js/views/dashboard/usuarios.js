import { guardRol } from "../../session/roleGuard.js"
import { userService } from "../../services/userService.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"
import { exactDocument } from "../../services/documentLookup.js"
import { createLookupGuard, trackLookupFields } from "./documentLookupUI.js"
import {
    abrirModal, cerrarModal, cerrarConEscape, filaVacia, filaError,
    rolesDe, nombreUsuario,
} from "./crud-comun.js"

/* La columna "Logeo" salio de la tabla y de los modales: es el identificador
   alfanumerico de la cuenta. Sigue estando en USUARIO — es lo que se le pasa a
   usp_PromoverAdmin(p_email) — pero no se pinta. Quien entra se reconoce por
   el nombre de la persona. */
const CELDAS = 6

/**
 * Solo ADMINISTRADOR. No por la interfaz: RLS de USUARIO es
 * auth_id = auth.uid() or is_admin(), asi que un cajero recibira una lista
 * vacia, y usp_PromoverAdmin vuelve a comprobar is_admin() por dentro.
 */
export async function usuariosController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR"])
    if (!roles) return

    /* ---------- elementos base (obligatorios) ---------- */
    const tbody = contenedor.querySelector("#usuarios-tbody")
    const modal = contenedor.querySelector("#usuarios-modal")
    const aviso = contenedor.querySelector("#usuarios-aviso")

    if (!tbody || !modal || !aviso) {
        console.error("usuariosController: faltan elementos base del DOM (tbody, modal o aviso)")
        return
    }

    const info = modal.querySelector("#usuarios-modal-info")
    const btnGuardar = modal.querySelector("#usuarios-modal-guardar")
    const btnCancelar = modal.querySelector("#usuarios-modal-cancelar")

    /* ---------- búsqueda por DNI (opcional) ---------- */
    const inputDNI = contenedor.querySelector("#usuarios-input-dni")
    const btnBuscarDNI = contenedor.querySelector("#usuarios-btn-buscar-dni")
    const btnLimpiarDNI = contenedor.querySelector("#usuarios-btn-limpiar-dni")
    const btnNuevo = contenedor.querySelector("#usuarios-btn-nuevo")

    const hayBuscador = Boolean(inputDNI && btnBuscarDNI && btnLimpiarDNI && btnNuevo)

    /* ---------- modal de registro manual (opcional) ---------- */
    const modalRegistro = contenedor.querySelector("#usuarios-modal-registro")
    let avisoRegistro = null
    let inputRegistroDNI = null
    let btnConsultarDNI = null
    let inputNombres = null
    let inputApPaterno = null
    let inputApMaterno = null
    let inputEmail = null
    let inputCelular = null
    let btnGuardarRegistro = null
    let btnCancelarRegistro = null

    const hayRegistro = Boolean(modalRegistro)
    if (hayRegistro) {
        avisoRegistro = modalRegistro.querySelector("#usuarios-modal-registro-aviso")
        inputRegistroDNI = modalRegistro.querySelector("#usuarios-registro-dni")
        btnConsultarDNI = modalRegistro.querySelector("#usuarios-registro-consultar-dni")
        inputNombres = modalRegistro.querySelector("#usuarios-registro-nombres")
        inputApPaterno = modalRegistro.querySelector("#usuarios-registro-apellido-paterno")
        inputApMaterno = modalRegistro.querySelector("#usuarios-registro-apellido-materno")
        inputEmail = modalRegistro.querySelector("#usuarios-registro-email")
        inputCelular = modalRegistro.querySelector("#usuarios-registro-celular")
        btnGuardarRegistro = modalRegistro.querySelector("#usuarios-modal-registro-guardar")
        btnCancelarRegistro = modalRegistro.querySelector("#usuarios-modal-registro-cancelar")
    }

    let usuarios = []
    let editando = null
    let filtroDNI = ""
    let timerBusqueda = null
    let lookupVigente = true
    let versionRegistro = 0
    let guardandoRegistro = false
    const lookupTabla = createLookupGuard(busy => { btnBuscarDNI.disabled = busy })
    const lookupRegistro = createLookupGuard(busy => { btnConsultarDNI.disabled = busy || inputRegistroDNI.disabled })
    const fields = trackLookupFields([inputNombres, inputApPaterno, inputApMaterno, inputEmail, inputCelular])

    const rUsuarios = await userService.listarUsuarios()
    usuarios = rUsuarios.ok ? rUsuarios.data : []

    if (!rUsuarios.ok) {
        aviso.hidden = false
        aviso.textContent = "No se pudo leer la lista de usuarios."
    }

    let rolSeleccionado = "ADMINISTRADOR"

    const btnRolAdmin = modal.querySelector('[data-rol="ADMINISTRADOR"]')
    const btnRolCajero = modal.querySelector('[data-rol="CAJERO"]')
    const btnRolMozo = modal.querySelector('[data-rol="MOZO"]')

    function marcarRol(rol) {
        rolSeleccionado = rol
        ;[btnRolAdmin, btnRolCajero, btnRolMozo].forEach((b) => {
            const activo = b.dataset.rol === rol
            b.classList.toggle("active", activo)
        })
    }

    btnRolAdmin.addEventListener("click", () => marcarRol("ADMINISTRADOR"))
    btnRolCajero.addEventListener("click", () => marcarRol("CAJERO"))
    btnRolMozo.addEventListener("click", () => marcarRol("MOZO"))

    marcarRol("ADMINISTRADOR")

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

    function dniDe(usuario) {
        const persona = usuario.CLIENTE?.[0]?.PERSONA?.[0] || usuario.EMPLEADO?.[0]?.PERSONA?.[0]
        return persona?.N_Documento || "—"
    }

    function usuariosFiltrados() {
        if (!filtroDNI) return usuarios
        const busca = String(filtroDNI).trim()
        return usuarios.filter(u => dniDe(u) === busca)
    }

    function pintarTabla() {
        const lista = usuariosFiltrados()

        if (!rUsuarios.ok) {
            tbody.innerHTML = filaError(CELDAS, "los usuarios")
            return
        }
        if (!lista.length) {
            const texto = filtroDNI
                ? `No se encontro usuario con DNI "${escaparHTML(filtroDNI)}"`
                : "No hay usuarios registrados"
            tbody.innerHTML = filaVacia(CELDAS, texto)
            return
        }

        tbody.innerHTML = lista.map(u => {
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

    /* ---------- promoción a administrador ---------- */

    function abrirPromover(id) {
        const usuario = usuarios.find(u => u.ID_Usuario === Number(id))
        if (!usuario) return
        editando = usuario
        const nombre = nombreDe(usuario)
        rolSeleccionado = "ADMINISTRADOR"
        marcarRol("ADMINISTRADOR")
        info.innerHTML = `Vas a promover a <strong>${escaparHTML(nombre)}</strong>
                          como <strong>${escaparHTML(rolSeleccionado)}</strong>.
                          Su lista de roles passara a ser solo ese rol.`
        abrirModal(modal, btnGuardar)
    }

    async function promover() {
        if (!editando) return

        const email = editando.Logeo
        if (!email) {
            return notifyWarning("Esta cuenta no tiene correo registrado, no se puede promover")
        }

        btnGuardar.disabled = true

        let resultado
        if (rolSeleccionado === "ADMINISTRADOR") {
            resultado = await userService.promoverAAdmin(email)
        } else if (rolSeleccionado === "CAJERO") {
            resultado = await userService.promoverACajero(email)
        } else if (rolSeleccionado === "MOZO") {
            resultado = await userService.promoverAMozo(email)
        } else {
            btnGuardar.disabled = false
            return notifyError("Rol no valido")
        }

        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al promover usuario:", resultado.error)
            return notifyError("No se pudo promover al usuario. Intente de nuevo mas tarde.")
        }

        notifySuccess(`${nombreDe(editando)} ahora es ${rolSeleccionado.toLowerCase()}`)
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

    /* ---------- búsqueda por DNI (base de datos) ---------- */

    function ejecutarBusquedaDNI() {
        if (!hayBuscador) return
        filtroDNI = inputDNI.value.trim()
        btnLimpiarDNI.hidden = !filtroDNI
        pintarTabla()
    }

    function completarRegistro(d) {
        fields.fill([[inputNombres, d.nombre], [inputApPaterno, d.apPaterno], [inputApMaterno, d.apMaterno],
            [inputEmail, d.email], [inputCelular, d.celular]])
    }

    async function buscarDNIEnBD() {
        if (!hayBuscador || !lookupVigente) return
        const dni = exactDocument(inputDNI.value, 8)
        if (!dni) return notifyWarning("Ingresa un DNI valido de 8 digitos")
        const request = lookupTabla.start(() => inputDNI.value === dni)
        if (!request) return
        clearTimeout(timerBusqueda)
        try {
            const resultado = await userService.buscarORegistrarUsuarioPorDNI(dni)
            if (!request.current()) return
            if (!resultado.ok) return notifyError(resultado.error.message)
            if (resultado.origen === "bd") {
                filtroDNI = dni
                btnLimpiarDNI.hidden = false
                pintarTabla()
                notifySuccess(`Usuario encontrado: ${nombreUsuario(resultado.data)}`)
            } else if (hayRegistro && modalRegistro.hidden && resultado.listoParaRegistrar) {
                abrirRegistro()
                inputRegistroDNI.value = dni
                completarRegistro(resultado.data)
                inputRegistroDNI.disabled = true
                btnConsultarDNI.disabled = true
                mostrarAvisoRegistro(`Revisa y completa los datos del DNI ${dni} antes de registrar.`, "info")
            }
        } catch {
            if (request.current()) notifyError("No se pudo consultar el DNI")
        } finally {
            request.finish()
        }
    }

    /* ---------- registro manual por DNI ---------- */

    function mostrarAvisoRegistro(texto, tipo = "info") {
        if (!hayRegistro || !avisoRegistro) return
        avisoRegistro.hidden = false
        avisoRegistro.textContent = texto
        avisoRegistro.className = `modal-nota modal-nota--${tipo}`
    }

    function ocultarAvisoRegistro() {
        if (!hayRegistro || !avisoRegistro) return
        avisoRegistro.hidden = true
    }

    function abrirRegistro() {
        if (!hayRegistro || !lookupVigente) return
        lookupTabla.invalidate()
        lookupRegistro.invalidate()
        versionRegistro++
        fields.reset()
        editando = null
        inputRegistroDNI.value = ""
        inputNombres.value = ""
        inputApPaterno.value = ""
        inputApMaterno.value = ""
        inputEmail.value = ""
        inputCelular.value = ""
        ocultarAvisoRegistro()
        inputRegistroDNI.disabled = false
        btnConsultarDNI.disabled = false
        btnGuardarRegistro.disabled = guardandoRegistro
        modalRegistro.hidden = false
        document.body.classList.add("sin-scroll")
        inputRegistroDNI.focus()
    }

    function cerrarRegistro() {
        if (!hayRegistro) return
        versionRegistro++
        lookupRegistro.invalidate()
        modalRegistro.hidden = true
        document.body.classList.remove("sin-scroll")
        editando = null
    }

    async function consultarDNIExterno() {
        if (!hayRegistro || !lookupVigente || modalRegistro.hidden || inputRegistroDNI.disabled || guardandoRegistro) return
        const dni = exactDocument(inputRegistroDNI.value, 8)
        if (!dni) return notifyWarning("Ingresa un DNI valido de 8 digitos antes de consultar")
        const request = lookupRegistro.start(() => !modalRegistro.hidden && inputRegistroDNI.value === dni)
        if (!request) return
        mostrarAvisoRegistro("Consultando DNI...", "info")
        try {
            const consulta = await userService.buscarORegistrarUsuarioPorDNI(dni)
            if (!request.current()) return
            if (!consulta.ok) return mostrarAvisoRegistro(consulta.error.message, "warning")
            if (consulta.origen === "bd") {
                return mostrarAvisoRegistro(`Este DNI ya esta registrado como usuario (${nombreUsuario(consulta.data)}).`, "warning")
            }
            completarRegistro(consulta.data)
            mostrarAvisoRegistro(`Revisa y completa los datos del DNI ${dni} antes de registrar.`, "success")
        } catch {
            if (request.current()) mostrarAvisoRegistro("No se pudo consultar el DNI", "warning")
        } finally {
            request.finish()
        }
    }

    async function guardarRegistro() {
        if (!hayRegistro || !lookupVigente || modalRegistro.hidden || guardandoRegistro) return
        const dni = exactDocument(inputRegistroDNI.value, 8)
        const nombres = inputNombres.value.trim()
        const apPaterno = inputApPaterno.value.trim()
        const apMaterno = inputApMaterno.value.trim()
        const email = inputEmail.value.trim()
        const celular = inputCelular.value.trim()

        if (!dni) {
            return notifyWarning("Ingresa un DNI valido de 8 digitos")
        }
        if (!nombres) {
            return notifyWarning("Ingresa los nombres")
        }

        const version = versionRegistro
        lookupRegistro.invalidate()
        ocultarAvisoRegistro()
        guardandoRegistro = true
        btnGuardarRegistro.disabled = true
        let resultado
        try {
            resultado = await userService.registrarUsuarioManual({
                nDocumento: dni, nombre: nombres, apPaterno, apMaterno,
                email: email || null, celular: celular || null, logeo: email || dni,
            })
        } catch {
            resultado = { ok: false, error: { message: "No se pudo registrar el usuario" } }
        } finally {
            guardandoRegistro = false
            btnGuardarRegistro.disabled = false
        }
        if (!lookupVigente) return
        if (versionRegistro !== version || inputRegistroDNI.value !== dni) {
            if (resultado.ok) await recargar()
            return
        }

        if (!resultado.ok) {
            console.error("Error al registrar usuario manual:", resultado.error)
            if (resultado.error.existe) {
                return mostrarAvisoRegistro("Este DNI ya esta registrado en la base de datos.", "warning")
            }
            return notifyError(resultado.error.message || "No se pudo registrar el usuario")
        }

        notifySuccess(`Usuario ${nombres} ${apPaterno || ""} registrado correctamente`)
        cerrarRegistro()
        await recargar()
    }

    /* ---------- eventos ---------- */

    tbody.addEventListener("click", e => {
        const btn = e.target.closest('[data-accion="promover"]')
        if (!btn) return
        const usuario = usuarios.find(u => u.ID_Usuario === Number(btn.dataset.id))
        if (!usuario) return
        abrirPromover(usuario.ID_Usuario)
    })

    if (btnCancelar) btnCancelar.addEventListener("click", () => cerrarModal(modal))
    if (btnGuardar) btnGuardar.addEventListener("click", promover)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    /* Busqueda por DNI: al teclear y al pulsar el boton */
    if (hayBuscador) {
        inputDNI.addEventListener("input", () => {
            if (!lookupVigente) return
            lookupTabla.invalidate()
            clearTimeout(timerBusqueda)
            timerBusqueda = setTimeout(ejecutarBusquedaDNI, 300)
        })
        btnBuscarDNI.addEventListener("click", buscarDNIEnBD)
        btnLimpiarDNI.addEventListener("click", () => {
            clearTimeout(timerBusqueda)
            lookupTabla.invalidate()
            inputDNI.value = ""
            filtroDNI = ""
            btnLimpiarDNI.hidden = true
            pintarTabla()
        })
    }

    /* Registro manual */
    if (hayRegistro) {
        if (btnNuevo) btnNuevo.addEventListener("click", abrirRegistro)
        if (btnCancelarRegistro) btnCancelarRegistro.addEventListener("click", cerrarRegistro)
        if (btnGuardarRegistro) btnGuardarRegistro.addEventListener("click", guardarRegistro)
        if (btnConsultarDNI) btnConsultarDNI.addEventListener("click", consultarDNIExterno)
        inputRegistroDNI.addEventListener("input", () => {
            lookupRegistro.invalidate()
            fields.documentChanged()
            ocultarAvisoRegistro()
        })
        modalRegistro.addEventListener("click", e => { if (e.target === modalRegistro) cerrarRegistro() })
    }

    const cleanup = cerrarConEscape(modal)
    const onEscape = e => { if (e.key === "Escape" && hayRegistro && !modalRegistro.hidden) cerrarRegistro() }
    document.addEventListener("keydown", onEscape)
    pintarTabla()

    return () => {
        lookupVigente = false
        clearTimeout(timerBusqueda)
        lookupTabla.invalidate()
        lookupRegistro.invalidate()
        document.removeEventListener("keydown", onEscape)
        cleanup()
    }
}

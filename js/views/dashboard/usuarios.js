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
    const selRol = modal.querySelector("#usuarios-input-rol")
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
            return notifyError("No se pudo promover al usuario. Intente de nuevo mas tarde.")
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

    /* ---------- búsqueda por DNI (base de datos) ---------- */

    function ejecutarBusquedaDNI() {
        if (!hayBuscador) return
        filtroDNI = inputDNI.value.trim()
        btnLimpiarDNI.hidden = !filtroDNI
        pintarTabla()
    }

    async function buscarDNIEnBD() {
        if (!hayBuscador) return
        const dni = inputDNI.value.trim()
        if (!/^\d{8}$/.test(dni)) {
            return notifyWarning("Ingresa un DNI valido de 8 digitos")
        }

        btnBuscarDNI.disabled = true
        const resultado = await userService.buscarUsuarioPorDNI(dni)
        btnBuscarDNI.disabled = false

        if (!resultado.ok) {
            console.error("Error al buscar usuario por DNI:", resultado.error)
            return notifyError("No se pudo buscar el usuario por DNI")
        }

        if (resultado.data) {
            // Se encontro en BD: mostrar solo ese usuario en la tabla
            filtroDNI = dni
            btnLimpiarDNI.hidden = false
            pintarTabla()
            notifySuccess(`Usuario encontrado: ${nombreUsuario(resultado.data)}`)
            return
        }

        // No esta en BD: consultar servicio externo con fallback silencioso de claves API.
        // El usuario no sabe que una clave individual fallo; solo se avisa si TODAS agotan.
        btnBuscarDNI.disabled = true
        const unificado = await userService.buscarORegistrarUsuarioPorDNI(dni)
        btnBuscarDNI.disabled = false

        if (!unificado.ok) {
            console.error("Error al consultar DNI externo:", unificado.error)
            return notifyError(unificado.error.message || "No se pudo consultar el DNI")
        }

        if (unificado.origen === "externo" && unificado.listoParaRegistrar) {
            const d = unificado.data
            // Abrir el modal de registro con los datos obtenidos precargados
            inputRegistroDNI.value = d.nDocumento
            inputNombres.value = d.nombre || ""
            inputApPaterno.value = d.apPaterno || ""
            inputApMaterno.value = d.apMaterno || ""
            inputEmail.value = d.email || ""
            inputCelular.value = d.celular || ""
            inputRegistroDNI.disabled = true
            btnConsultarDNI.disabled = true
            btnGuardarRegistro.disabled = false
            ocultarAvisoRegistro()
            modalRegistro.hidden = false
            document.body.classList.add("sin-scroll")
            mostrarAvisoRegistro(
                `DNI ${dni} no encontrado en la base de datos. Se obtuvieron datos del servicio externo. Revisa y completa los campos antes de registrar.`,
                "info"
            )
            return
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
        if (!hayRegistro) return
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
        btnGuardarRegistro.disabled = false
        modalRegistro.hidden = false
        document.body.classList.add("sin-scroll")
        inputRegistroDNI.focus()
    }

    function cerrarRegistro() {
        if (!hayRegistro) return
        modalRegistro.hidden = true
        document.body.classList.remove("sin-scroll")
        editando = null
    }

    async function consultarDNIExterno() {
        if (!hayRegistro) return
        const dni = inputRegistroDNI.value.trim()
        if (!/^\d{8}$/.test(dni)) {
            return notifyWarning("Ingresa un DNI valido de 8 digitos antes de consultar")
        }

        btnConsultarDNI.disabled = true
        mostrarAvisoRegistro("Consultando DNI en servicios externos...", "info")

        // 1) Primero se busca en la base de datos
        const enBD = await userService.buscarUsuarioPorDNI(dni)
        if (enBD.ok && enBD.data) {
            btnConsultarDNI.disabled = false
            return mostrarAvisoRegistro(
                `Este DNI ya esta registrado como usuario (${nombreUsuario(enBD.data)}).`,
                "warning"
            )
        }

        // 2) Si no esta en BD, se consulta al token (API externa) con fallback de claves
        const consulta = await userService.consultarDNIExterno(dni)
        btnConsultarDNI.disabled = false

        if (!consulta.ok) {
            console.error("Error al consultar DNI externo:", consulta.error)
            // Solo se notifica al usuario cuando TODAS las claves estan agotadas
            const mensaje =
                consulta.error?.message ||
                (consulta.error?.agotadas ? `Todas las ${consulta.error.agotadas} claves de API estan agotadas` : "No se pudo consultar el DNI")
            return notifyError(mensaje)
        }

        const d = consulta.data
        inputNombres.value = d.nombres || ""
        inputApPaterno.value = d.apellidoPaterno || ""
        inputApMaterno.value = d.apellidoMaterno || ""
        mostrarAvisoRegistro(
            `Datos obtenidos del DNI ${dni}: ${d.nombres || ""} ${d.apellidoPaterno || ""} ${d.apellidoMaterno || ""}. Revisa y completa los campos antes de registrar.`,
            "success"
        )
    }

    async function guardarRegistro() {
        if (!hayRegistro) return
        const dni = inputRegistroDNI.value.trim()
        const nombres = inputNombres.value.trim()
        const apPaterno = inputApPaterno.value.trim()
        const apMaterno = inputApMaterno.value.trim()
        const email = inputEmail.value.trim()
        const celular = inputCelular.value.trim()

        if (!/^\d{8}$/.test(dni)) {
            return notifyWarning("Ingresa un DNI valido de 8 digitos")
        }
        if (!nombres) {
            return notifyWarning("Ingresa los nombres")
        }

        btnGuardarRegistro.disabled = true

        // Verificar que no exista ya (doble comprobacion por si se registro entre tanto)
        const enBD = await userService.buscarUsuarioPorDNI(dni)
        if (enBD.ok && enBD.data) {
            btnGuardarRegistro.disabled = false
            return mostrarAvisoRegistro(
                `El DNI ${dni} ya esta registrado en la base de datos.`,
                "warning"
            )
        }

        const resultado = await userService.registrarUsuarioManual({
            nDocumento: dni,
            nombre: nombres,
            apPaterno: apPaterno,
            apMaterno: apMaterno,
            email: email || null,
            celular: celular || null,
            logeo: email || dni,
        })
        btnGuardarRegistro.disabled = false

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
        // se pide confirmacion aparte: es una accion que no tiene vuelta atras
        const usuario = usuarios.find(u => u.ID_Usuario === Number(btn.dataset.id))
        if (!usuario) return
        confirmarBorrado({
            titulo: "Promover a administrador",
            cuerpo: `<p>${escaparHTML(nombreDe(usuario))} pasara a ser ADMINISTRADOR
                     y perdra sus roles actuales (${escaparHTML(rolesDe(usuario))}).</p>
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

    if (btnCancelar) btnCancelar.addEventListener("click", () => cerrarModal(modal))
    if (btnGuardar) btnGuardar.addEventListener("click", promover)
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    /* Busqueda por DNI: al teclear y al pulsar el boton */
    if (hayBuscador) {
        inputDNI.addEventListener("input", () => {
            clearTimeout(timerBusqueda)
            timerBusqueda = setTimeout(ejecutarBusquedaDNI, 300)
        })
        btnBuscarDNI.addEventListener("click", buscarDNIEnBD)
        btnLimpiarDNI.addEventListener("click", () => {
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
        modalRegistro.addEventListener("click", e => { if (e.target === modalRegistro) cerrarRegistro() })
    }

    const cleanup = cerrarConEscape(modal, modalRegistro)
    pintarTabla()

    return cleanup
}

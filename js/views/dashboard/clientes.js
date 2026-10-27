import { clientService } from "../../services/clientService.js"
import { authService } from "../../services/authService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"

const TIPO_CLIENTE = { N: "Natural", J: "Jurídico" }

export async function clientesController(contenedor) {
    const [clientesR, sesion] = await Promise.all([
        clientService.listarClientes(),
        authService.obtenerSesion()
    ])

    const usucre = sesion.ok ? (sesion.data?.Logeo || sesion.data?.email || "WEB") : "WEB"

    let clientes = clientesR.ok ? clientesR.data : []
    let personas = []
    let empresas = []
    let editandoId = null

    const tbodyEl = contenedor.querySelector("#clientes-tbody")
    const modalEl = contenedor.querySelector("#clientes-modal")
    const selTipo = modalEl.querySelector("#clientes-input-tipo")
    const selPersona = modalEl.querySelector("#clientes-input-persona")
    const campoPersona = modalEl.querySelector("#clientes-campo-persona")
    const campoEmpresa = modalEl.querySelector("#clientes-campo-empresa")
    const selEmpresa = modalEl.querySelector("#clientes-input-empresa")
    const inPuntos = modalEl.querySelector("#clientes-input-puntos")
    const inObservacion = modalEl.querySelector("#clientes-input-observacion")
    const btnGuardar = modalEl.querySelector("#clientes-modal-guardar")
    const btnCancelar = modalEl.querySelector("#clientes-modal-cancelar")
    const btnNuevo = contenedor.querySelector("#clientes-nuevo")
    const titulo = modalEl.querySelector("#clientes-modal-titulo")

    /* ---------- carga de catálogos ---------- */

    async function cargarCatalogo() {
        const [rPersonas, rEmpresas] = await Promise.all([
            clientService.listarPersonasDisponibles(),
            clientService.listarEmpresasDisponibles()
        ])
        personas = rPersonas.ok ? rPersonas.data : []
        empresas = rEmpresas.ok ? rEmpresas.data : []

        selPersona.replaceChildren(
            ...personas.map(p => {
                const o = document.createElement("option")
                o.value = p.ID_Persona
                o.textContent = `${escaparHTML(p.Nombre || "")} ${escaparHTML(p.Ap_Paterno || "")} — ${escaparHTML(p.N_Documento || "")}`
                return o
            })
        )
        selEmpresa.replaceChildren(
            ...empresas.map(e => {
                const o = document.createElement("option")
                o.value = e.ID_Empresa
                o.textContent = `${escaparHTML(e.Razon_Social || "")} — RUC ${escaparHTML(e.RUC || "")}`
                return o
            })
        )
    }

    /* ---------- tabla ---------- */

    function pintarTabla() {
        if (!clientes.length) {
            tbodyEl.innerHTML = '<tr class="fila-vacia"><td colspan="9">No hay clientes. Crea el primero.</td></tr>'
            return
        }

        tbodyEl.innerHTML = clientes.map(c => {
            const p = c.PERSONA?.[0]
            const e = c.EMPRESA?.[0]
            const tipo = c.Tipo_Cliente === "N"
                ? `${escaparHTML((p && p.Nombre) ? `${p.Nombre} ${p.Ap_Paterno || ""}`.trim() : "Persona")}`
                : `${escaparHTML((e && e.Razon_Social) ? e.Razon_Social : "Empresa")}`
            const doc = c.Tipo_Cliente === "N"
                ? (p ? escaparHTML(p.N_Documento || "-") : "-")
                : (e ? escaparHTML(e.RUC || "-") : "-")
            const email = c.Tipo_Cliente === "N"
                ? (p ? escaparHTML(p.EMAIL || "-") : "-")
                : (e ? "-" : "-")
            const telefono = c.Tipo_Cliente === "N"
                ? (p ? escaparHTML(p.Celular || "-") : "-")
                : "-"

            return `
                <tr data-id="${c.ID_Cliente}">
                    <td>${c.ID_Cliente}</td>
                    <td>${TIPO_CLIENTE[c.Tipo_Cliente] || c.Tipo_Cliente}</td>
                    <td><strong>${tipo}</strong></td>
                    <td>${doc}</td>
                    <td>${email}</td>
                    <td>${telefono}</td>
                    <td>${Number(c.Puntos || 0)}</td>
                    <td>
                        <button class="btn-icono" type="button" data-accion="editar" data-id="${c.ID_Cliente}" title="Editar" aria-label="Editar cliente ${c.ID_Cliente}">${icono("pencil", { size: 16 })}</button>
                    </td>
                    <td>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar" data-id="${c.ID_Cliente}" title="Eliminar" aria-label="Eliminar cliente ${c.ID_Cliente}">${icono("trash-2", { size: 16 })}</button>
                    </td>
                </tr>
            `
        }).join("")
    }

    /* ---------- modal ---------- */

    function alternarCampos() {
        const esNatural = selTipo.value === "N"
        campoPersona.hidden = !esNatural
        campoEmpresa.hidden = esNatural
        selPersona.required = esNatural
        selEmpresa.required = !esNatural
    }

    function abrirNuevo() {
        editandoId = null
        titulo.textContent = "Nuevo cliente"
        selTipo.value = "N"
        selTipo.disabled = false
        selPersona.value = ""
        selEmpresa.value = ""
        inPuntos.value = 0
        inObservacion.value = ""
        alternarCampos()
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        selTipo.focus()
    }

    function abrirEdicion(cliente) {
        editandoId = cliente.ID_Cliente
        titulo.textContent = `Editar cliente ${cliente.ID_Cliente}`
        selTipo.value = cliente.Tipo_Cliente || "N"
        selTipo.disabled = true
        selPersona.value = cliente.PERSONA?.[0]?.ID_Persona || ""
        selEmpresa.value = cliente.EMPRESA?.[0]?.ID_Empresa || ""
        inPuntos.value = cliente.Puntos || 0
        inObservacion.value = cliente.Observacion || ""
        alternarCampos()
        modalEl.hidden = false
        document.body.classList.add("sin-scroll")
        inPuntos.focus()
    }

    function cerrarModal() {
        modalEl.hidden = true
        editandoId = null
        document.body.classList.remove("sin-scroll")
    }

    async function guardar() {
        const tipo = selTipo.value
        let idRef = null
        if (tipo === "N") {
            idRef = Number(selPersona.value)
            if (!idRef) return notifyWarning("Selecciona una persona")
        } else {
            idRef = Number(selEmpresa.value)
            if (!idRef) return notifyWarning("Selecciona una empresa")
        }

        const datos = {
            ID_Persona: tipo === "N" ? idRef : null,
            ID_Empresa: tipo === "J" ? idRef : null,
            Tipo_Cliente: tipo,
            Puntos: Number(inPuntos.value) || 0,
            Observacion: inObservacion.value.trim() || null,
            USUCRE: usucre
        }

        btnGuardar.disabled = true
        const resultado = editandoId
            ? await clientService.actualizarCliente(editandoId, datos)
            : await clientService.crearCliente(datos)
        btnGuardar.disabled = false

        if (!resultado.ok) {
            console.error("Error al guardar cliente:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo guardar el cliente")
        }

        notifySuccess(editandoId ? "Cliente actualizado" : "Cliente creado")
        cerrarModal()
        await recargar()
    }

    async function eliminarCliente(id) {
        const cliente = clientes.find(c => c.ID_Cliente === id)
        if (!cliente) return

        const confirmacion = new (await import("../../components/Modal.js")).Modal({
            title: "Eliminar cliente",
            body: `<p>Se desactivara el cliente <strong>#${cliente.ID_Cliente}</strong>.</p>
                   <p class="modal-nota">Es un borrado logico: se marca como inactivo y no se puede deshacer desde aqui.</p>`,
            actions: [
                { label: "Cancelar", className: "btn btn--ghost" },
                {
                    label: "Eliminar",
                    className: "btn btn--danger",
                    onClick: async (modal, boton) => {
                        boton.disabled = true
                        const resultado = await clientService.eliminarCliente(id)
                        boton.disabled = false
                        modal.close()
                        if (!resultado.ok) {
                            console.error("Error al eliminar cliente:", resultado.error)
                            return notifyError("No se pudo eliminar el cliente")
                        }
                        notifySuccess("Cliente eliminado")
                        await recargar()
                    }
                }
            ]
        })
        confirmacion.open()
    }

    async function recargar() {
        const r = await clientService.listarClientes()
        if (r.ok) {
            clientes = r.data
        } else {
            console.error("Error al recargar clientes:", r.error)
            return notifyError("No se pudieron recargar los clientes")
        }
        pintarTabla()
    }

    /* ---------- eventos ---------- */

    await cargarCatalogo()
    pintarTabla()

    tbodyEl.addEventListener("click", e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const cliente = clientes.find(c => c.ID_Cliente === Number(btn.dataset.id))
        if (!cliente) return
        if (btn.dataset.accion === "editar") abrirEdicion(cliente)
        else eliminarCliente(cliente.ID_Cliente)
    })

    btnNuevo.addEventListener("click", abrirNuevo)
    btnCancelar.addEventListener("click", cerrarModal)
    btnGuardar.addEventListener("click", guardar)
    selTipo.addEventListener("change", alternarCampos)
    modalEl.addEventListener("click", e => { if (e.target === modalEl) cerrarModal() })
    modalEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") guardar()
    })

    const onEscape = e => { if (e.key === "Escape" && !modalEl.hidden) cerrarModal() }
    document.addEventListener("keydown", onEscape)

    return () => {
        document.removeEventListener("keydown", onEscape)
        document.body.classList.remove("sin-scroll")
    }
}

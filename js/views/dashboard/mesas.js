import { guardRol } from "../../session/roleGuard.js"
import { tableService } from "../../services/tableService.js"
import { icono } from "../../components/Icon.js"
import { notifySuccess, notifyError, notifyWarning } from "../../utils/notify.js"
import { escaparHTML } from "../../utils/format.js"
import {
    abrirModal, cerrarModal, cerrarConEscape, confirmarBorrado,
} from "./crud-comun.js"

/* ==========================================================================
   SALÓN — mesas por zona
   --------------------------------------------------------------------------
   Dos permisos distintos en la misma pantalla, porque el RLS tambien lo es
   (sql/018_fixes.sql:255):

     ADMINISTRADOR  alta, edicion y borrado de mesas y zonas
     CAJERO / MOZO  solo cambiar el estado de una mesa

   El selector de estado esta siempre visible para quien tenga sesion de
   operativo: es la accion que un mozo hace cien veces al dia, y meterla en
   un modal de edicion la haria mas lenta que un formulario.
   ========================================================================== */

/* El Color lo pone el admin en ESTADO_MESA y acaba en un style="" del DOM.
   Solo se admiten hexadecimales: cualquier otra cosa se ignora y se usa el
   color por defecto de la ficha. */
const COLOR_SEGURO = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export async function mesasController(contenedor) {
    const roles = await guardRol(["ADMINISTRADOR", "CAJERO", "MOZO"])
    if (!roles) return

    const esAdmin = roles.includes("ADMINISTRADOR")

    const raiz = contenedor.querySelector("#mesas-zonas")
    const aviso = contenedor.querySelector("#mesas-aviso")
    const modal = contenedor.querySelector("#mesas-modal")
    const modalZona = contenedor.querySelector("#mesas-zona-modal")

    const inNumero = modal.querySelector("#mesas-input-numero")
    const selZona = modal.querySelector("#mesas-input-zona")
    const selEstado = modal.querySelector("#mesas-input-estado")
    const inCapacidad = modal.querySelector("#mesas-input-capacidad")
    const inDetalle = modal.querySelector("#mesas-input-detalle")
    const titulo = modal.querySelector("#mesas-modal-titulo")
    const btnEliminarMesa = modal.querySelector("#mesas-modal-eliminar")

    const inZonaNombre = modalZona.querySelector("#mesas-zona-nombre")
    const inZonaDesc = modalZona.querySelector("#mesas-zona-descripcion")
    const tituloZona = modalZona.querySelector("#mesas-zona-titulo")
    const btnEliminarZona = modalZona.querySelector("#mesas-zona-eliminar")

    let mesas = []
    let zonas = []
    let estados = []
    let editandoMesa = null
    let editandoZona = null

    /* ---------- carga ---------- */

    async function cargar() {
        const [rMesas, rZonas, rEstados] = await Promise.all([
            tableService.listarMesas(),
            tableService.listarZonas(),
            tableService.listarEstados(),
        ])
        mesas = rMesas.ok ? rMesas.data : []
        zonas = rZonas.ok ? rZonas.data : []
        estados = rEstados.ok ? rEstados.data : []
        return rMesas.ok
    }

    const ok = await cargar()
    raiz.setAttribute("aria-busy", "false")

    if (!ok) {
        aviso.hidden = false
        aviso.textContent = "No se pudo leer el salón."
    }
    if (!estados.length) {
        // sin ESTADO_MESA no hay ni el formulario ni el selector de estado
        aviso.hidden = false
        aviso.textContent = "No hay estados de mesa configurados en la base de datos."
    }

    if (!esAdmin) {
        contenedor.querySelectorAll(".js-solo-admin").forEach(el => el.remove())
    } else {
        if (!zonas.length) {
            aviso.hidden = false
            aviso.textContent = "Crea una zona antes de dar de alta mesas."
        }
        selZona.replaceChildren(...zonas.map(z => {
            const o = document.createElement("option")
            o.value = z.ID_Zona
            o.textContent = z.N_Zona
            return o
        }))
        selEstado.replaceChildren(...estados.map(e => {
            const o = document.createElement("option")
            o.value = e.ID_EstadoMesa
            o.textContent = e.Descripcion
            return o
        }))
    }

    /* ---------- pintado ---------- */

    function opcionesEstado(seleccionado) {
        return estados.map(e => {
            const o = document.createElement("option")
            o.value = e.ID_EstadoMesa
            o.textContent = e.Descripcion
            if (String(e.ID_EstadoMesa) === String(seleccionado)) o.selected = true
            return o
        })
    }

    function fichaMesa(mesa) {
        const est = mesa.ESTADO_MESA?.[0]
        const color = COLOR_SEGURO.test(est?.Color || "") ? est.Color : ""
        const capacidad = Number(mesa.Capacidad) || 0

        return `
            <article class="mesa-card${color ? "" : " mesa-card--sin-color"}">
                <header class="mesa-card__cabecera">
                    <span class="mesa-card__numero">${escaparHTML(String(mesa.Numero))}</span>
                    <span class="mesa-card__estado">
                        <span class="mesa-card__punto"${color ? ` style="background-color: ${escaparHTML(color)}"` : ""} aria-hidden="true"></span>
                        ${escaparHTML(est?.Descripcion || "Sin estado")}
                    </span>
                </header>

                <p class="mesa-card__capacidad">
                    ${icono("users", { size: 14 })}
                    <span>${capacidad} ${capacidad === 1 ? "persona" : "personas"}</span>
                </p>

                ${mesa.Detalle ? `<p class="mesa-card__detalle">${escaparHTML(mesa.Detalle)}</p>` : ""}

                <label class="mesa-card__selector">
                    <span class="vacio-inline">Estado</span>
                    <select class="select" data-estado="${mesa.ID_Mesa}"></select>
                </label>

                ${esAdmin ? `
                    <div class="mesa-card__acciones">
                        <button class="btn-icono" type="button" data-accion="editar" data-id="${mesa.ID_Mesa}"
                                title="Editar mesa" aria-label="Editar mesa">${icono("pencil", { size: 16 })}</button>
                        <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar" data-id="${mesa.ID_Mesa}"
                                title="Eliminar mesa" aria-label="Eliminar mesa">${icono("trash-2", { size: 16 })}</button>
                    </div>` : ""}
            </article>
        `
    }

    function pintar() {
        raiz.replaceChildren()

        if (!mesas.length && !zonas.length) {
            const vacio = document.createElement("p")
            vacio.className = "vacio"
            vacio.textContent = "Todavía no hay mesas registradas"
            raiz.appendChild(vacio)
            return
        }

        // se pintan todas las zonas, tb las vacias: si no, una zona nueva
        // desapareceria hasta que se le crease la primera mesa
        for (const zona of zonas) {
            const propias = mesas.filter(m => m.ID_Zona === zona.ID_Zona)

            const seccion = document.createElement("section")
            seccion.className = "salon__zona"

            const cabecera = document.createElement("header")
            cabecera.className = "salon__cabecera"

            const nombre = document.createElement("h2")
            nombre.className = "salon__zona-nombre"
            nombre.textContent = zona.N_Zona
            cabecera.appendChild(nombre)

            const contador = document.createElement("span")
            contador.className = "salon__contador"
            contador.textContent = `${propias.length} ${propias.length === 1 ? "mesa" : "mesas"}`
            cabecera.appendChild(contador)

            if (esAdmin) {
                const acciones = document.createElement("div")
                acciones.className = "salon__acciones"
                acciones.innerHTML = `
                    <button class="btn-icono" type="button" data-accion="editar-zona" data-id="${zona.ID_Zona}"
                            title="Editar zona" aria-label="Editar zona">${icono("pencil", { size: 16 })}</button>
                    <button class="btn-icono btn-icono--peligro" type="button" data-accion="eliminar-zona" data-id="${zona.ID_Zona}"
                            title="Eliminar zona" aria-label="Eliminar zona">${icono("trash-2", { size: 16 })}</button>
                `
                cabecera.appendChild(acciones)
            }

            seccion.appendChild(cabecera)

            if (propias.length) {
                const rejilla = document.createElement("div")
                rejilla.className = "salon__rejilla"
                rejilla.innerHTML = propias.map(fichaMesa).join("")
                seccion.appendChild(rejilla)
            } else {
                const vacia = document.createElement("p")
                vacia.className = "vacio"
                vacia.textContent = "Esta zona no tiene mesas"
                seccion.appendChild(vacia)
            }

            raiz.appendChild(seccion)
        }

        raiz.querySelectorAll("select[data-estado]").forEach(sel => {
            const mesa = mesas.find(m => String(m.ID_Mesa) === sel.dataset.estado)
            sel.replaceChildren(...opcionesEstado(mesa?.ID_EstadoMesa))
        })
    }

    /* ---------- acciones de ficha ---------- */

    async function cambiarEstado(id, idEstadoMesa) {
        const resultado = await tableService.cambiarEstadoMesa(id, idEstadoMesa)
        if (!resultado.ok) {
            console.error("Error al cambiar el estado de la mesa:", resultado.error)
            notifyError(resultado.error?.message || "No se pudo cambiar el estado")
            return
        }
        // se relee en vez de dar por bueno el <select>: lo que se ve tiene que
        // ser lo que hay en MESA, no lo que el usuario acaba de elegir
        const r = await tableService.listarMesas()
        if (r.ok) mesas = r.data
        pintar()
    }

    function abrirMesa(id) {
        const mesa = mesas.find(m => String(m.ID_Mesa) === String(id))
        if (!mesa) return
        editandoMesa = mesa
        titulo.textContent = `Mesa ${mesa.Numero}`
        inNumero.value = mesa.Numero
        selZona.value = mesa.ID_Zona
        selEstado.value = mesa.ID_EstadoMesa
        inCapacidad.value = mesa.Capacidad
        inDetalle.value = mesa.Detalle || ""
        btnEliminarMesa.hidden = false
        abrirModal(modal, inNumero)
    }

    function abrirMesaNueva() {
        if (!zonas.length) return notifyWarning("Crea primero una zona")
        editandoMesa = null
        titulo.textContent = "Nueva mesa"
        inNumero.value = ""
        selZona.value = zonas[0].ID_Zona
        selEstado.value = estados[0]?.ID_EstadoMesa ?? ""
        inCapacidad.value = 4
        inDetalle.value = ""
        btnEliminarMesa.hidden = true
        abrirModal(modal, inNumero)
    }

    async function guardarMesa() {
        const datos = {
            Numero: inNumero.value,
            ID_Zona: selZona.value,
            ID_EstadoMesa: selEstado.value,
            Capacidad: inCapacidad.value,
            Detalle: inDetalle.value,
        }
        const resultado = editandoMesa
            ? await tableService.actualizarMesa(editandoMesa.ID_Mesa, datos)
            : await tableService.crearMesa(datos)

        if (!resultado.ok) {
            console.error("Error al guardar la mesa:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo guardar la mesa")
        }

        notifySuccess(editandoMesa ? "Mesa actualizada" : "Mesa creada")
        cerrarModal(modal)
        editandoMesa = null
        await recargar()
    }

    function eliminarMesa(id) {
        const mesa = mesas.find(m => String(m.ID_Mesa) === String(id))
        if (!mesa) return
        confirmarBorrado({
            titulo: "Eliminar mesa",
            cuerpo: `<p>Se eliminara la mesa <strong>${escaparHTML(String(mesa.Numero))}</strong>.</p>
                     <p class="modal-nota modal-nota--peligro">Si tiene pedidos o reservas asociados no se podra borrar.</p>`,
            onConfirm: async () => {
                const resultado = await tableService.eliminarMesa(mesa.ID_Mesa)
                if (!resultado.ok) {
                    console.error("Error al eliminar la mesa:", resultado.error)
                    return notifyError(resultado.error?.message || "No se pudo eliminar la mesa")
                }
                notifySuccess("Mesa eliminada")
                await recargar()
            },
        })
    }

    /* ---------- zonas ---------- */

    function abrirZona(id) {
        const zona = zonas.find(z => String(z.ID_Zona) === String(id))
        editandoZona = zona || null
        tituloZona.textContent = zona ? `Zona ${zona.N_Zona}` : "Nueva zona"
        inZonaNombre.value = zona?.N_Zona || ""
        inZonaDesc.value = zona?.Descripcion || ""
        btnEliminarZona.hidden = !zona
        abrirModal(modalZona, inZonaNombre)
    }

    async function guardarZona() {
        const datos = { N_Zona: inZonaNombre.value, Descripcion: inZonaDesc.value }
        const resultado = editandoZona
            ? await tableService.actualizarZona(editandoZona.ID_Zona, datos)
            : await tableService.crearZona(datos)

        if (!resultado.ok) {
            console.error("Error al guardar la zona:", resultado.error)
            return notifyError(resultado.error?.message || "No se pudo guardar la zona")
        }

        notifySuccess(editandoZona ? "Zona actualizada" : "Zona creada")
        cerrarModal(modalZona)
        editandoZona = null
        await recargar()
    }

    function eliminarZona(id) {
        const zona = zonas.find(z => String(z.ID_Zona) === String(id))
        if (!zona) return
        const cuantas = mesas.filter(m => m.ID_Zona === zona.ID_Zona).length
        confirmarBorrado({
            titulo: "Eliminar zona",
            cuerpo: `<p>Se eliminara la zona <strong>${escaparHTML(zona.N_Zona)}</strong>${cuantas ? ` y sus ${cuantas} mesa${cuantas === 1 ? "" : "s"}` : ""}.</p>
                     <p class="modal-nota modal-nota--peligro">Borrado fisico, no se puede deshacer.</p>`,
            onConfirm: async () => {
                const resultado = await tableService.eliminarZona(zona.ID_Zona)
                if (!resultado.ok) {
                    console.error("Error al eliminar la zona:", resultado.error)
                    return notifyError(resultado.error?.message || "No se pudo eliminar la zona")
                }
                notifySuccess("Zona eliminada")
                await recargar()
            },
        })
    }

    /** Se relee en vez de recargar la pagina: ver el motivo en pedidos.js. */
    async function recargar() {
        const [rMesas, rZonas] = await Promise.all([
            tableService.listarMesas(),
            tableService.listarZonas(),
        ])
        mesas = rMesas.ok ? rMesas.data : mesas
        zonas = rZonas.ok ? rZonas.data : zonas
        // una zona nueva tiene que aparecer en el desplegable del formulario
        if (esAdmin) {
            const seleccion = selZona.value
            selZona.replaceChildren(...zonas.map(z => {
                const o = document.createElement("option")
                o.value = z.ID_Zona
                o.textContent = z.N_Zona
                return o
            }))
            if (zonas.some(z => String(z.ID_Zona) === String(seleccion))) selZona.value = seleccion
        }
        pintar()
    }

    /* ---------- eventos ---------- */

    const onChange = e => {
        const sel = e.target.closest("select[data-estado]")
        if (!sel) return
        cambiarEstado(sel.dataset.estado, sel.value)
    }

    const onClick = e => {
        const btn = e.target.closest("[data-accion]")
        if (!btn) return
        const { accion, id } = btn.dataset
        if (accion === "editar") abrirMesa(id)
        else if (accion === "eliminar") eliminarMesa(id)
        else if (accion === "editar-zona") abrirZona(id)
        else if (accion === "eliminar-zona") eliminarZona(id)
    }

    raiz.addEventListener("change", onChange)
    raiz.addEventListener("click", onClick)

    const btnNueva = contenedor.querySelector("#mesas-nueva")
    if (btnNueva) btnNueva.addEventListener("click", abrirMesaNueva)
    const btnNuevaZona = contenedor.querySelector("#mesas-nueva-zona")
    if (btnNuevaZona) btnNuevaZona.addEventListener("click", () => abrirZona(null))

    modal.querySelector("#mesas-modal-cancelar").addEventListener("click", () => cerrarModal(modal))
    modal.querySelector("#mesas-modal-guardar").addEventListener("click", guardarMesa)
    btnEliminarMesa.addEventListener("click", () => {
        if (editandoMesa) eliminarMesa(editandoMesa.ID_Mesa)
    })
    modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(modal) })

    modalZona.querySelector("#mesas-zona-cancelar").addEventListener("click", () => cerrarModal(modalZona))
    modalZona.querySelector("#mesas-zona-guardar").addEventListener("click", guardarZona)
    btnEliminarZona.addEventListener("click", () => {
        if (editandoZona) eliminarZona(editandoZona.ID_Zona)
    })
    modalZona.addEventListener("click", e => { if (e.target === modalZona) cerrarModal(modalZona) })

    const cleanupCerrar = cerrarConEscape(modal, modalZona)
    pintar()

    return () => {
        cleanupCerrar()
        raiz.removeEventListener("change", onChange)
        raiz.removeEventListener("click", onClick)
    }
}
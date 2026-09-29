import { Modal } from "../../components/Modal.js"
import { icono } from "../../components/Icon.js"
import { escaparHTML } from "../../utils/format.js"
import { filaVacia, filaError } from "./crud-comun.js"

/* ==========================================================================
   BASE DE LAS VISTAS "mis-*"
   --------------------------------------------------------------------------
   Los tres listados del cliente son solo lectura y tienen la misma forma:
   cargar, ordenar, pintar y abrir un detalle. Se resuelve aqui para que cada
   controlador se quede en lo unico que cambia, que es que columnas lleva.
   ========================================================================== */

/** Botón de "ver más". Sin items se desactiva: no hay nada que abrir. */
export function botonDetalle(indice, etiqueta, cuantos) {
    if (!cuantos) {
        return '<span class="vacio-inline" title="Sin contenido">—</span>'
    }
    // icono(), no icon().outerHTML: el <svg> de Reicon vive en su shadow root,
    // asi que outerHTML de un <re-icon> recien creado sale vacio
    const svg = icono("eye", { size: 16 })
    return `<button class="btn-icono" type="button" data-detalle="${indice}" title="${escaparHTML(etiqueta)}" aria-label="${escaparHTML(etiqueta)}">${svg}</button>`
}

/** El listado mas reciente primero, sin depender del orden del adapter. */
function ordenar(datos) {
    return [...datos].sort((a, b) => {
        const fa = a.F_Pedido || a.F_Reserva || a.F_Envio || a.FECCRE || ""
        const fb = b.F_Pedido || b.F_Reserva || b.F_Envio || b.FECCRE || ""
        return String(fb).localeCompare(String(fa))
    })
}

/**
 * @param {object} cfg
 * @param {Element}  cfg.contenedor  nodo de la vista
 * @param {string}   cfg.tbody       selector del <tbody>
 * @param {number}   cfg.celdas      columnas, para el colspan de las filas de aviso
 * @param {Function} cfg.cargar      devuelve { ok, data }
 * @param {string}   cfg.que         que se lee, para el texto de los avisos
 * @param {string}   cfg.vacio       texto cuando no hay nada
 * @param {Function} cfg.filas       (datos, botonDetalle) => html
 * @param {Function} [cfg.detalle]   (fila) => html del modal de detalle
 */
export async function tablaSimple({ contenedor, tbody, celdas, cargar, que, vacio, filas, detalle }) {
    const cuerpo = contenedor.querySelector(tbody)
    const resultado = await cargar()

    if (!resultado.ok) {
        console.error(`Error al leer ${que}:`, resultado.error)
        cuerpo.innerHTML = filaError(celdas, que)
        return () => {}
    }

    const datos = ordenar(resultado.data || [])
    if (!datos.length) {
        cuerpo.innerHTML = filaVacia(celdas, vacio)
        return () => {}
    }

    const abrirDetalle = (indice) => {
        if (!detalle) return
        const modal = new Modal({
            title: "Detalle",
            body: detalle(datos[indice]),
            actions: [{ label: "Cerrar", className: "btn btn--ghost" }],
        })
        modal.open()
    }

    cuerpo.innerHTML = filas(datos, botonDetalle)

    const onClick = e => {
        const btn = e.target.closest("[data-detalle]")
        if (!btn) return
        abrirDetalle(Number(btn.dataset.detalle))
    }
    cuerpo.addEventListener("click", onClick)

    return () => cuerpo.removeEventListener("click", onClick)
}

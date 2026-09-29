import { icono } from "../../components/Icon.js"

/* ==========================================================================
   VISTA NOSOTROS
   --------------------------------------------------------------------------
   Es contenido estatico, pero los iconos del HTML se pintan desde aqui para
   no meter SVG a mano en el parcial.
   ========================================================================== */

export async function nosotrosController(contenedor) {
    contenedor.querySelectorAll("[data-icono]").forEach(nodo => {
        nodo.innerHTML = icono(nodo.dataset.icono, { size: 26 })
    })
}

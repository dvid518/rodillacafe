import { messageService } from "../../services/messageService.js"
import { icono } from "../../components/Icon.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import { ESTADO_MENSAJE, badge } from "./crud-comun.js"
import { tablaSimple } from "./mis-comun.js"

const CELDAS = 5

export async function misMensajesController(contenedor) {
    return tablaSimple({
        contenedor,
        tbody: "#mis-mensajes-tbody",
        celdas: CELDAS,
        cargar: () => messageService.listarMisMensajes(),
        que: "tus mensajes",
        vacio: "Todavía no has enviado ningún mensaje",
        /* El cuerpo del mensaje es largo, asi que la celda lo recorta y el
           Asunto hace de disparador del detalle. No se añade una sexta
           columna: la vista tiene cinco. */
        filas: mensajes => mensajes.map((m, i) => {
            // icono(), no icon().outerHTML: el <svg> de Reicon vive en su
            // shadow root, asi que outerHTML de un <re-icon> sale vacio
            const svg = icono("eye", { size: 16 })
            const asunto = m.Asunto?.trim() || `Mensaje ${m.ID_Mensaje}`
            return `
            <tr>
                <td>${m.ID_Mensaje}</td>
                <td>${escaparHTML(formatearFecha(m.F_Envio || m.FECCRE, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>
                    <button class="enlace-fila" type="button" data-detalle="${i}" title="Leer el mensaje completo">
                        ${escaparHTML(asunto)} ${svg}
                    </button>
                </td>
                <td class="celda-obs">${escaparHTML(m.Mensaje || "—")}</td>
                <td>${badge(ESTADO_MENSAJE, m.Situacion)}</td>
            </tr>
        `
        }).join(""),
        detalle: m => `
            <p class="detalle__asunto">${escaparHTML(m.Asunto || "Sin asunto")}</p>
            <p class="detalle__texto">${escaparHTML(m.Mensaje || "")}</p>
            <p class="detalle__meta">Enviado el ${escaparHTML(formatearFecha(m.F_Envio || m.FECCRE, { dateStyle: "long", timeStyle: "short" }))}</p>
        `,
    })
}

import "./../session/guard.js"
import { messageService } from "../services/messageService.js"

const LABEL_ESTADO = {
    R: "Recibido",
    L: "Leído"
}

function formatearFecha(iso) {
    if (!iso) return "-"
    const fecha = new Date(iso)
    return fecha.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })
}

function crearFila(mensaje) {
    return `
        <tr>
            <td>${mensaje.ID_Mensaje}</td>
            <td>${formatearFecha(mensaje.F_Mensaje)}</td>
            <td>${mensaje.Asunto || "-"}</td>
            <td>${mensaje.Mensaje || "-"}</td>
            <td>${LABEL_ESTADO[mensaje.Situacion] || mensaje.Situacion}</td>
        </tr>
    `
}

function renderTabla(lista) {
    const tbody = document.getElementById("mensajes-tbody")
    if (!tbody) return
    tbody.innerHTML = lista.map(mensaje => crearFila(mensaje)).join("")
}

async function iniciarPanel() {
    try {
        const resultado = await messageService.listarMisMensajes()
        if (!resultado.ok) {
            console.error("Error al cargar mensajes:", resultado.error)
            return
        }
        renderTabla(resultado.data || [])
    } catch (error) {
        console.error("Error al cargar mensajes:", error)
    }
}

iniciarPanel()
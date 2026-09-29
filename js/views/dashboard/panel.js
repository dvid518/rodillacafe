import { orderService } from "../../services/orderService.js"
import { reservationService } from "../../services/reservationService.js"
import { messageService } from "../../services/messageService.js"
import { productService } from "../../services/productService.js"
import { categoryService } from "../../services/categoryService.js"
import { authService } from "../../services/authService.js"
import { userService } from "../../services/userService.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import { icono, NOMBRES } from "../../components/Icon.js"

/** Rellena los <span data-icono="x"> del markup con el SVG de Icon.js. */
function hidratarIconos(raiz) {
    for (const span of raiz.querySelectorAll("[data-icono]")) {
        const nombre = span.dataset.icono
        span.innerHTML = NOMBRES.includes(nombre) ? icono(nombre, { size: 20 }) : ""
    }
}

const LABEL_ESTADO = { P: "Pendiente", A: "Aprobado", F: "Completado", X: "Anulado" }

/** F_Reserva es el unico datetime de RESERVA; se recorta a HH:MM en 24h. */
function formatearHora(iso) {
    if (!iso) return "-"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "-"
    return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/**
 * PEDIDO no trae USUARIO embebido (ver PERFIL_SELECT de OrderAdapter), asi
 * que el Logeo del cliente hay que resolverlo aparte contra USUARIO.
 */
function nombreCliente(pedido, usuariosPorId) {
    const usuario = usuariosPorId.get(pedido.ID_Usuario)
    const persona = usuario?.CLIENTE?.[0]?.PERSONA?.[0]
    if (persona?.Nombre) {
        return escaparHTML(`${persona.Nombre} ${persona.Ap_Paterno || ""}`.trim())
    }
    if (usuario?.Logeo) return escaparHTML(usuario.Logeo)
    return "-"
}

function badge(estado) {
    const etiqueta = LABEL_ESTADO[estado]
    if (!etiqueta) return escaparHTML(String(estado ?? "-"))
    return `<span class="badge badge--${escaparHTML(estado.toLowerCase())}">${escaparHTML(etiqueta)}</span>`
}

export async function panelController(contenedor) {
    const [perfil, pedidos, reservas, mensajes, productos, categorias, usuarios] = await Promise.all([
        authService.obtenerPerfil(),
        orderService.listarTodos(),
        reservationService.listarTodas(),
        messageService.listarTodos(),
        productService.listarProductosAdmin(),
        categoryService.listarCategorias(),
        userService.listarUsuarios()
    ])

    const nombre = perfil.ok ? (perfil.data.nombre || perfil.data.Logeo) : null
    contenedor.querySelector("#panel-bienvenida").textContent = nombre ? `Bienvenido, ${nombre}` : "Bienvenido"

    const usuariosPorId = new Map(
        (usuarios.ok ? usuarios.data : []).map(u => [u.ID_Usuario, u])
    )

    /* Si una consulta fallo no se muestra 0: 0 es un dato real ("no hay
       pedidos") y 0 tambien seria el resultado de un error. Se distingue. */
    const conteo = (r) => (r.ok ? r.data.length : null)

    const kpis = [
        { titulo: "Pedidos", valor: conteo(pedidos), sub: pedidos.ok ? `${pedidos.data.filter(p => p.Situacion === "P").length} pendientes` : "No disponible", icono: "receipt" },
        { titulo: "Reservas", valor: conteo(reservas), sub: reservas.ok ? `${reservas.data.filter(r => r.Situacion === "P").length} pendientes` : "No disponible", icono: "calendar-days" },
        { titulo: "Mensajes", valor: conteo(mensajes), sub: mensajes.ok ? "Recibidos" : "No disponible", icono: "mail" },
        { titulo: "Productos", valor: conteo(productos), sub: productos.ok ? "En carta" : "No disponible", icono: "coffee" },
        { titulo: "Categorias", valor: conteo(categorias), sub: categorias.ok ? "Activas" : "No disponible", icono: "boxes" }
    ]

    const grid = contenedor.querySelector("#kpis-grid")
    grid.replaceChildren(...kpis.map(kpi => {
        const card = document.createElement("article")
        card.className = "kpi-card glass"
        card.innerHTML = `
            <span class="kpi-card__icono" data-icono="${kpi.icono}"></span>
            <span class="kpi-card__label">${escaparHTML(kpi.titulo)}</span>
            <strong class="kpi-card__valor">${kpi.valor === null ? "--" : kpi.valor}</strong>
            <span class="kpi-card__sub">${escaparHTML(kpi.sub)}</span>
        `
        return card
    }))
    hidratarIconos(grid)

    const tbodyPedidos = contenedor.querySelector("#panel-ultimos-pedidos")
    if (pedidos.ok) {
        const ultimos = pedidos.data.slice(0, 5)
        tbodyPedidos.innerHTML = ultimos.map(p => `
            <tr>
                <td>${escaparHTML(String(p.Numero_Pedido ?? p.ID_Pedido))}</td>
                <td>${nombreCliente(p, usuariosPorId)}</td>
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>S/ ${Number(p.Total || 0).toFixed(2)}</td>
                <td>${badge(p.Situacion)}</td>
            </tr>
        `).join("") || '<tr><td colspan="5" class="vacio">Sin pedidos</td></tr>'
    } else {
        tbodyPedidos.innerHTML = '<tr><td colspan="5" class="vacio">No se pudieron leer los pedidos</td></tr>'
    }

    const tbodyReservas = contenedor.querySelector("#panel-proximas-reservas")
    if (reservas.ok) {
        const proximas = reservas.data
            .filter(r => r.Situacion !== "X" && r.F_Reserva && new Date(r.F_Reserva) >= new Date())
            .sort((a, b) => new Date(a.F_Reserva) - new Date(b.F_Reserva))
            .slice(0, 5)
        tbodyReservas.innerHTML = proximas.map(r => {
            const persona = r.CLIENTE?.[0]?.PERSONA?.[0]
            const quien = persona?.Nombre
                ? escaparHTML(`${persona.Nombre} ${persona.Ap_Paterno || ""}`.trim())
                : `Mesa ${escaparHTML(String(r.Numero_Mesa ?? "-"))}`
            return `
                <tr>
                    <td>${escaparHTML(formatearFecha(r.F_Reserva, { dateStyle: "medium" }))}</td>
                    <td>${escaparHTML(formatearHora(r.F_Reserva))}</td>
                    <td>${r.N_Comensales ?? "-"} &middot; ${quien}</td>
                    <td>${badge(r.Situacion)}</td>
                </tr>
            `
        }).join("") || '<tr><td colspan="4" class="vacio">Sin reservas próximas</td></tr>'
    } else {
        tbodyReservas.innerHTML = '<tr><td colspan="4" class="vacio">No se pudieron leer las reservas</td></tr>'
    }

    hidratarIconos(contenedor)
}

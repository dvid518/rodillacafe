import { orderService } from "../../services/orderService.js"
import { reservationService } from "../../services/reservationService.js"
import { messageService } from "../../services/messageService.js"
import { productService } from "../../services/productService.js"
import { categoryService } from "../../services/categoryService.js"
import { authService } from "../../services/authService.js"
import { userService } from "../../services/userService.js"
import { reporteService } from "../../services/reporteService.js"
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
 * PEDIDO no trae USUARIO embebido de forma utilizable (ver PERFIL_SELECT de
 * OrderAdapter), asi que el nombre hay que resolverlo aparte contra USUARIO.
 *
 * El identificador alfanumerico del pedido no se pinta: la fila se identifica
 * por cliente y fecha. Para un pedido sin cliente resuelto sale "Sin cliente",
 * que es un dato real, no un identificador.
 */
function nombreCliente(pedido, usuariosPorId) {
    const usuario = usuariosPorId.get(pedido.ID_Usuario)
    const persona = usuario?.CLIENTE?.[0]?.PERSONA?.[0]
    if (persona?.Nombre) {
        return escaparHTML(`${persona.Nombre} ${persona.Ap_Paterno || ""}`.trim())
    }
    // los empleados no tienen CLIENTE: su nombre vive en EMPLEADO.PERSONA
    const empleado = usuario?.EMPLEADO?.[0]?.PERSONA?.[0]
    if (empleado?.Nombre) {
        return escaparHTML(`${empleado.Nombre} ${empleado.Ap_Paterno || ""}`.trim())
    }
    return "Sin cliente"
}

function badge(estado) {
    const etiqueta = LABEL_ESTADO[estado]
    if (!etiqueta) return escaparHTML(String(estado ?? "-"))
    return `<span class="badge badge--${escaparHTML(estado.toLowerCase())}">${escaparHTML(etiqueta)}</span>`
}

export async function panelController(contenedor) {
    let intervaloRefresco = null
    let graficoVentas = null

    const [perfil, pedidos, reservas, mensajes, productos, categorias, usuarios] = await Promise.all([
        authService.obtenerPerfil(),
        orderService.listarTodos(),
        reservationService.listarTodas(),
        messageService.listarTodos(),
        productService.listarProductosAdmin(),
        categoryService.listarCategorias(),
        userService.listarUsuarios()
    ])

    // sin nombre de persona (empleados que no tienen CLIENTE) se saluda sin
    // nombre: antes caia al Logeo, que es el identificador de la cuenta
    const nombre = perfil.ok ? (perfil.data.nombre || "") : ""
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
                <td>${nombreCliente(p, usuariosPorId)}</td>
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>S/ ${Number(p.Total || 0).toFixed(2)}</td>
                <td>${badge(p.Situacion)}</td>
            </tr>
        `).join("") || '<tr><td colspan="4" class="vacio">Sin pedidos</td></tr>'
    } else {
        tbodyPedidos.innerHTML = '<tr><td colspan="4" class="vacio">No se pudieron leer los pedidos</td></tr>'
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

    /* ---------- grafico de ventas por dia ---------- */

    async function cargarGraficoVentas() {
        const canvas = document.getElementById("panel-grafico-ventas")
        if (!canvas) return
        if (graficoVentas) graficoVentas.destroy()

        const hoy = new Date()
        const hace7 = new Date(hoy)
        hace7.setDate(hoy.getDate() - 6)
        const formatoISO = d => d.toISOString().split("T")[0]

        const r = await reporteService.ventasPorDia(formatoISO(hace7), formatoISO(hoy), "E")
        const data = r.ok ? r.data : []

        // Rellenar dias sin ventas con 0
        const dias = []
        const valores = {}
        data.forEach(d => { valores[String(d.fecha).split("T")[0]] = Number(d.total || 0) })
        for (let i = 0; i < 7; i++) {
            const dia = new Date(hoy)
            dia.setDate(hoy.getDate() - 6 + i)
            const key = formatoISO(dia)
            dias.push(key)
            valores[key] = valores[key] || 0
        }
        dias.sort()

        graficoVentas = new window.Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: dias.map(d => {
                    const dd = new Date(d + "T00:00:00")
                    return dd.toLocaleDateString("es-PE", { day: "numeric", month: "short" })
                }),
                datasets: [{
                    label: "Ventas (S/)",
                    data: dias.map(d => valores[d]),
                    borderColor: "#a82b13",
                    backgroundColor: "rgba(168, 43, 19, 0.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => `S/ ${v}` } } }
            }
        })
    }

    /* ---------- refresco periodico de KPIs ---------- */

    async function refrescarKPIs() {
        const [rPedidos, rReservas, rMensajes, rProductos, rCategorias] = await Promise.all([
            orderService.listarTodos(),
            reservationService.listarTodas(),
            messageService.listarTodos(),
            productService.listarProductosAdmin(),
            categoryService.listarCategorias()
        ])
        const conteo = (r) => (r.ok ? r.data.length : null)
        const kpis = [
            { titulo: "Pedidos", valor: conteo(rPedidos), icono: "receipt" },
            { titulo: "Reservas", valor: conteo(rReservas), icono: "calendar-days" },
            { titulo: "Mensajes", valor: conteo(rMensajes), icono: "mail" },
            { titulo: "Productos", valor: conteo(rProductos), icono: "coffee" },
            { titulo: "Categorias", valor: conteo(rCategorias), icono: "boxes" }
        ]
        const grid = contenedor.querySelector("#kpis-grid")
        if (!grid) return
        grid.replaceChildren(...kpis.map(kpi => {
            const card = document.createElement("article")
            card.className = "kpi-card glass"
            card.innerHTML = `
                <span class="kpi-card__icono" data-icono="${kpi.icono}"></span>
                <span class="kpi-card__label">${escaparHTML(kpi.titulo)}</span>
                <strong class="kpi-card__valor">${kpi.valor === null ? "--" : kpi.valor}</strong>
            `
            return card
        }))
        hidratarIconos(grid)
        await cargarGraficoVentas()
    }

    /* ---------- auto-refresh cada 30s ---------- */

    intervaloRefresco = setInterval(refrescarKPIs, 30000)

    /* ---------- boton actualizar manual ---------- */

    const btnActualizar = contenedor.querySelector("#panel-actualizar")
    if (btnActualizar) {
        btnActualizar.addEventListener("click", () => {
            btnActualizar.disabled = true
            btnActualizar.textContent = "Actualizando..."
            refrescarKPIs().finally(() => {
                btnActualizar.disabled = false
                btnActualizar.textContent = "Actualizar"
            })
        })
    }

    await cargarGraficoVentas()

    hidratarIconos(contenedor)

    return () => {
        if (intervaloRefresco) clearInterval(intervaloRefresco)
        if (graficoVentas) graficoVentas.destroy()
        document.body.classList.remove("sin-scroll")
    }
}

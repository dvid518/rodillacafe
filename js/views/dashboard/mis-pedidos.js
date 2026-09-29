import { orderService } from "../../services/orderService.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import { ESTADO_PEDIDO, badge, monto } from "./crud-comun.js"
import { tablaSimple, botonDetalle } from "./mis-comun.js"

const CELDAS = 5

export async function misPedidosController(contenedor) {
    return tablaSimple({
        contenedor,
        tbody: "#mis-pedidos-tbody",
        celdas: CELDAS,
        cargar: () => orderService.listarMisPedidos(),
        que: "tus pedidos",
        vacio: "Todavía no has hecho ningún pedido",
        filas: (pedidos, boton) => pedidos.map((p, i) => `
            <tr>
                <td>${escaparHTML(String(p.Numero_Pedido ?? p.ID_Pedido))}</td>
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(monto(p.Total))}</td>
                <td>${badge(ESTADO_PEDIDO, p.Situacion)}</td>
                <td>${boton(i, `Ver detalle del pedido ${p.Numero_Pedido ?? p.ID_Pedido}`, (p.DETALLE_PEDIDO || []).length)}</td>
            </tr>
        `).join(""),
        detalle: p => (p.DETALLE_PEDIDO || []).map(d => `
            <div class="producto-item">
                <span>${escaparHTML(d.PRODUCTO?.[0]?.N_Producto || `Producto ${d.ID_Producto}`)}</span>
                <span>${d.Cantidad} × ${escaparHTML(monto(d.Precio))}</span>
                <strong>${escaparHTML(monto(Number(d.Cantidad) * Number(d.Precio)))}</strong>
            </div>
        `).join("") || '<p class="vacio">Este pedido no tiene productos</p>',
    })
}

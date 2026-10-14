import { orderService } from "../../services/orderService.js"
import { formatearFecha, escaparHTML } from "../../utils/format.js"
import { ESTADO_PEDIDO, badge, monto } from "./crud-comun.js"
import { tablaSimple, botonDetalle } from "./mis-comun.js"

/* Sin Numero_Pedido: el cliente ve fecha, total, estado y el detalle, que es
   lo que le sirve para reconocer un pedido. El identificador alfanumerico se
   sigue guardando en PEDIDO, pero no sale por pantalla. */
const CELDAS = 4

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
                <td>${escaparHTML(formatearFecha(p.F_Pedido, { dateStyle: "short", timeStyle: "short" }))}</td>
                <td>${escaparHTML(monto(p.Total))}</td>
                <td>${badge(ESTADO_PEDIDO, p.Situacion)}</td>
                <td>${boton(i, "Ver detalle del pedido", (p.DETALLE_PEDIDO || []).length)}</td>
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

import { productService } from "../../services/productService.js"
import { Card } from "../../components/Card.js"
import { carritoRodilla } from "../../controllers/carrito.js"
import { icono } from "../../components/Icon.js"

/* ==========================================================================
   VISTA HOME
   --------------------------------------------------------------------------
   Ojo con la API de Card: categoria es un parametro de primer nivel, no va
   dentro de producto. Si se nestinga, la clase sale "card-producto undefined
   glass" y el producto pierde su color de categoria.
   ========================================================================== */

/** Traduce la fila de PRODUCTO_PUBLICO al shape que espera Card. */
function aProducto(p) {
    return {
        id: p.ID_Producto,
        nombre: p.N_Producto,
        precio: p.Precio,
        img: p.Imagen,
        detalle: p.Detalle,
    }
}

/** Mapea ID_CategoriaProducto -> seccion, para colorear la tarjeta. */
function seccionDe(categoriaId) {
    const id = Number(categoriaId)
    if ([1, 2, 6].includes(id)) return "bebidas"
    if (id === 3) return "postres"
    return "aperitivos"
}

function confirmarAgregado(boton) {
    boton.textContent = "Agregado"
    boton.disabled = true
    setTimeout(() => {
        boton.textContent = "Agregar al carrito"
        boton.disabled = false
    }, 700)
}

export async function homeController(contenedor) {
    // iconos decorativos del HTML estatico
    contenedor.querySelectorAll("[data-icono]").forEach(nodo => {
        nodo.innerHTML = icono(nodo.dataset.icono, { size: 26 })
    })

    const grid = contenedor.querySelector("#destacados-grid")
    if (!grid) return

    let productos = []
    try {
        const resultado = await productService.listarProductos()
        if (!resultado.ok) throw resultado.error
        productos = resultado.data || []
    } catch (error) {
        console.error("Error al cargar destacados:", error)
        grid.innerHTML = '<p class="vacio vacio--error">No pudimos cargar los destacados.</p>'
        return
    }

    if (!productos.length) {
        grid.innerHTML = '<p class="vacio">Todavía no hay productos cargados.</p>'
        return
    }

    const destacados = productos.slice(0, 4)
    const fragmento = document.createDocumentFragment()

    for (const fila of destacados) {
        const producto = aProducto(fila)
        const tarjeta = new Card({
            producto,
            categoria: seccionDe(fila.ID_CategoriaProducto),
            onAgregar: (p, boton) => {
                carritoRodilla.agregarProducto(p)
                confirmarAgregado(boton)
            },
        }).render()
        fragmento.appendChild(tarjeta)
    }

    grid.replaceChildren(fragmento)
}

import { categoryService } from "../../services/categoryService.js"
import { productService } from "../../services/productService.js"
import { Card } from "../../components/Card.js"
import { carritoRodilla } from "../../controllers/carrito.js"

/* ==========================================================================
   VISTA MENU
   --------------------------------------------------------------------------
   El filtro no se hace por ID sino por el NOMBRE de la categoria, porque
   la DB tiene 6 (CAFES CALIENTES, BEBIDAS FRIAS, POSTRES, SANDWICHES,
   DESAYUNOS, ADICIONALES) y el menu agrupa en 3 secciones.

   Y OJO: en Card, categoria es parametro de primer nivel, no va dentro de
   producto.
   ========================================================================== */

const SECCIONES = {
    bebidas: ["CAFES CALIENTES", "BEBIDAS FRIAS"],
    postres: ["POSTRES"],
    aperitivos: ["SANDWICHES", "DESAYUNOS", "ADICIONALES"],
}

const FILTROS = [
    { clave: "", titulo: "Todo" },
    { clave: "bebidas", titulo: "Bebidas" },
    { clave: "postres", titulo: "Postres" },
    { clave: "aperitivos", titulo: "Aperitivos" },
]

function aProducto(p) {
    return {
        id: p.ID_Producto,
        nombre: p.N_Producto,
        precio: p.Precio,
        img: p.Imagen,
        detalle: p.Detalle,
    }
}

function confirmarAgregado(boton) {
    boton.textContent = "Agregado"
    boton.disabled = true
    setTimeout(() => {
        boton.textContent = "Agregar al carrito"
        boton.disabled = false
    }, 700)
}

export async function menuController(contenedor) {
    const filtros = contenedor.querySelector("#menu-filtros")
    const grid = contenedor.querySelector("#menu-grid")
    if (!grid || !filtros) return

    let categorias = []
    let productos = []
    try {
        const [cat, prod] = await Promise.all([
            categoryService.listarCategorias(),
            productService.listarProductos(),
        ])
        if (!cat.ok) throw cat.error
        if (!prod.ok) throw prod.error
        categorias = cat.data || []
        productos = prod.data || []
    } catch (error) {
        console.error("Error al cargar el menu:", error)
        grid.innerHTML = '<p class="vacio vacio--error">No pudimos cargar el menú.</p>'
        return
    }

    const nombreDe = new Map(
        categorias.map(c => [String(c.ID_CategoriaProducto), c.N_CategoriaProducto])
    )

    function render(seccion = "") {
        const visibles = productos.filter(p => {
            if (!seccion) return true
            const nombre = nombreDe.get(String(p.ID_CategoriaProducto))
            return nombre && (SECCIONES[seccion] || []).includes(nombre)
        })

        if (!visibles.length) {
            grid.innerHTML = '<p class="vacio">No hay productos en esta categoría.</p>'
            return
        }

        const fragmento = document.createDocumentFragment()
        for (const fila of visibles) {
            const tarjeta = new Card({
                producto: aProducto(fila),
                categoria: seccion,
                onAgregar: (p, boton) => {
                    carritoRodilla.agregarProducto(p)
                    confirmarAgregado(boton)
                },
            }).render()
            fragmento.appendChild(tarjeta)
        }
        grid.replaceChildren(fragmento)
    }

    // Los filtros se construyen con DOM, no con innerHTML: el nombre de la
    // categoria viene de la base y no va a entrar por interpolacion.
    const botones = new Map()
    for (const filtro of FILTROS) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "filtro"
        btn.dataset.categoria = filtro.clave
        btn.textContent = filtro.titulo
        if (!filtro.clave) btn.classList.add("filtro--activo")
        btn.setAttribute("aria-pressed", filtro.clave ? "false" : "true")
        botones.set(filtro.clave, btn)
        filtros.appendChild(btn)
    }

    filtros.addEventListener("click", evento => {
        const btn = evento.target.closest(".filtro")
        if (!btn || !filtros.contains(btn)) return

        for (const [clave, nodo] of botones) {
            const activo = clave === btn.dataset.categoria
            nodo.classList.toggle("filtro--activo", activo)
            nodo.setAttribute("aria-pressed", activo ? "true" : "false")
        }
        render(btn.dataset.categoria || "")
    })

    render()
}

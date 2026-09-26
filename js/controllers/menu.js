import { opcionalSesion, haySesion } from "../session/opcionalSesion.js"
import { categoryService } from "../services/categoryService.js"
import { productService } from "../services/productService.js"
import { carritoRodilla } from "./carrito.js"
import { Card } from "../components/Card.js"

const SECCIONES = {
    "bebidas": ["CAFES CALIENTES", "BEBIDAS FRIAS"],
    "postres": ["POSTRES"],
    "aperitivos": ["SANDWICHES", "DESAYUNOS", "ADICIONALES"]
}

function formatoProducto(producto, contenedor) {
    return {
        id: String(producto.ID_Producto),
        nombre: producto.N_Producto || "Producto",
        precio: Number(producto.Precio || 0),
        img: producto.Imagen || "",
        categoria: contenedor,
        detalle: producto.Detalle || ""
    }
}

function renderProductos(lista, containerId) {
    const container = document.getElementById(containerId)
    if (!container) return
    container.replaceChildren(...lista.map(producto => new Card({ producto }).render()))
}

function configurarBotonesAgregar() {
    document.addEventListener("click", evento => {
        const boton = evento.target.closest(".btn-agregar")
        if (!boton) return

        const producto = JSON.parse(decodeURIComponent(boton.dataset.producto))
        carritoRodilla.agregarProducto(producto)

        const texto = boton.textContent
        boton.textContent = "Agregado"
        boton.disabled = true

        setTimeout(() => {
            boton.textContent = texto
            boton.disabled = false
        }, 700)
    })
}

function mostrarBannerInvitado() {
    if (haySesion()) return
    const contenedor = document.querySelector("section.menu")
    if (!contenedor) return
    const banner = document.createElement("div")
    banner.classList.add("glass", "banner-guest")
    banner.innerHTML = 'Estás viendo el menú como invitado. <a href="/login.html?redirect=/menu.html">Inicia sesión</a> para realizar un pedido.'
    contenedor.insertBefore(banner, contenedor.firstChild)
}

async function iniciarMenu() {
    configurarBotonesAgregar()

    await opcionalSesion()
    mostrarBannerInvitado()

    const cats = await categoryService.listarCategorias()
    if (!cats.ok) {
        console.error("Error al cargar categorías:", cats.error)
        return
    }
    const productos = await productService.listarProductos()
    if (!productos.ok) {
        console.error("Error al cargar productos:", productos.error)
        return
    }

    const categorias = Object.fromEntries(cats.data.map(c => [String(c.ID_CategoriaProducto), c.N_CategoriaProducto]))

    Object.keys(SECCIONES).forEach(contenedor => {
        const nombres = SECCIONES[contenedor]
        const lista = productos.data.filter(p => {
            const nombreCat = categorias[String(p.ID_CategoriaProducto)]
            return nombreCat && nombres.includes(nombreCat)
        })
        renderProductos(lista.map(p => formatoProducto(p, contenedor)), contenedor)
    })
}

iniciarMenu()
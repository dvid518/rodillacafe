import { guardRol } from "../session/roleGuard.js"
import { categoryService } from "../services/categoryService.js"
import { productService } from "../services/productService.js"
import { authService } from "../services/authService.js"
import { escaparHTML } from "../utils/format.js"
import { Modal } from "../components/Modal.js"
import { notifyError, notifySuccess, notifyWarning } from "../utils/notify.js"

const SECCION_NOMBRES = {
    "bebidas": ["CAFES CALIENTES", "BEBIDAS FRIAS"],
    "postres": ["POSTRES"],
    "aperitivos": ["SANDWICHES", "DESAYUNOS", "ADICIONALES"]
}

const NOMBRES_SECCION = {
    "bebidas": "Bebida",
    "postres": "Postre",
    "aperitivos": "Aperitivo"
}

const categoriasMap = new Map()

async function iniciarPanel() {
    const roles = await guardRol(["ADMINISTRADOR"])
    if (!roles) return
    try {
        await cargarCategorias()
        const resultado = await productService.listarProductosAdmin()
        if (!resultado.ok) {
            console.error("Error al cargar productos:", resultado.error)
            return
        }
        const lista = resultado.data || []
        Object.keys(SECCION_NOMBRES).forEach(seccion => {
            const nombres = SECCION_NOMBRES[seccion]
            const productos = lista.filter(p => {
                const nombre = categoriasMap.get(String(p.ID_CategoriaProducto))
                return nombre != null && nombres.includes(nombre)
            })
            renderTabla(productos, seccion + "-tbody", seccion)
        })
    } catch (error) {
        console.error("Error al cargar productos:", error)
    }
}

async function cargarCategorias() {
    const resultado = await categoryService.listarCategorias()
    if (!resultado.ok) return resultado
    categoriasMap.clear()
    (resultado.data || []).forEach(c => {
        categoriasMap.set(String(c.ID_CategoriaProducto), c.N_CategoriaProducto)
    })
    return resultado
}

function seccionDeProducto(idCategoria) {
    const nombre = categoriasMap.get(String(idCategoria))
    if (!nombre) return null
    return Object.keys(SECCION_NOMBRES).find(seccion => SECCION_NOMBRES[seccion].includes(nombre)) || null
}

function idCategoriaDeSeccion(seccion) {
    if (!SECCION_NOMBRES[seccion]) return null
    const primerNombre = SECCION_NOMBRES[seccion][0]
    for (const [id, nombre] of categoriasMap) {
        if (nombre === primerNombre) return Number(id)
    }
    return null
}

async function cargarUnidades() {
    const resultado = await productService.listarUnidades()
    if (!resultado.ok) return resultado
    const select = document.getElementById("unidad")
    if (!select) return resultado
    select.innerHTML = '<option value="" disabled selected>Unidad de medida</option>'
    (resultado.data || []).forEach(u => {
        const opcion = document.createElement("option")
        opcion.value = String(u.ID_UnidadMedida)
        opcion.textContent = u.N_UnidadMedida
        select.appendChild(opcion)
    })
    return resultado
}

function crearFila(producto, seccion) {
    return `
        <tr>
            <td>
                <img src="${producto.Imagen || ""}" alt="${escaparHTML(producto.N_Producto)}">
            </td>
            <td>${producto.ID_Producto}</td>
            <td>${escaparHTML(producto.N_Producto)}</td>
            <td>${Number(producto.Precio || 0).toFixed(2)}</td>
            <td class="icon pencil">
                <button class="btn-edit" data-id="${producto.ID_Producto}" data-col="${seccion}">
                    <svg class="pencil" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.2942 7.95881C13.5533 7.63559 13.5013 7.16358 13.178 6.90453C12.8548 6.64549
                        12.3828 6.6975 12.1238 7.02072L13.2942 7.95881ZM6.811 14.8488L7.37903 15.3385C7.38489
                        15.3317 7.39062 15.3248 7.39623 15.3178L6.811 14.8488ZM6.64 15.2668L5.89146 15.2179L5.8908
                        15.2321L6.64 15.2668ZM6.5 18.2898L5.7508 18.2551C5.74908 18.2923 5.75013 18.3296 5.75396
                        18.3667L6.5 18.2898ZM7.287 18.9768L7.31152 19.7264C7.36154 19.7247 7.41126 19.7181 7.45996
                        19.7065L7.287 18.9768ZM10.287 18.2658L10.46 18.9956L10.4716 18.9927L10.287 18.2658ZM10.672
                        18.0218L11.2506 18.4991L11.2571 18.491L10.672 18.0218ZM17.2971 10.959C17.5562 10.6358 17.5043
                        10.1638 17.1812 9.90466C16.8581 9.64552 16.386 9.69742 16.1269 10.0206L17.2971 10.959ZM12.1269
                        7.02052C11.8678 7.34365 11.9196 7.81568 12.2428 8.07484C12.5659 8.33399 13.0379 8.28213 13.2971
                        7.95901L12.1269 7.02052ZM14.3 5.50976L14.8851 5.97901C14.8949 5.96672 14.9044 5.95412 14.9135
                        5.94123L14.3 5.50976ZM15.929 5.18976L16.4088 4.61332C16.3849 4.59344 16.3598 4.57507 16.3337
                        4.5583L15.929 5.18976ZM18.166 7.05176L18.6968 6.52192C18.6805 6.50561 18.6635 6.49007 18.6458
                        6.47532L18.166 7.05176ZM18.5029 7.87264L19.2529 7.87676V7.87676L18.5029 7.87264ZM18.157
                        8.68976L17.632 8.15412C17.6108 8.17496 17.5908 8.19704 17.5721 8.22025L18.157 8.68976ZM16.1271
                        10.0203C15.8678 10.3433 15.9195 10.8153 16.2425 11.0746C16.5655 11.3339 17.0376 11.2823 17.2969
                        10.9593L16.1271 10.0203ZM13.4537 7.37862C13.3923 6.96898 13.0105 6.68666 12.6009 6.74805C12.1912
                        6.80943 11.9089 7.19127 11.9703 7.60091L13.4537 7.37862ZM16.813 11.2329C17.2234 11.1772 17.5109
                        10.7992 17.4552 10.3888C17.3994 9.97834 17.0215 9.69082 16.611 9.74659L16.813 11.2329ZM12.1238
                        7.02072L6.22577 14.3797L7.39623 15.3178L13.2942 7.95881L12.1238 7.02072ZM6.24297 14.359C6.03561
                        14.5995 5.91226 14.9011 5.89159 15.218L7.38841 15.3156C7.38786 15.324 7.38457 15.3321 7.37903
                        15.3385L6.24297 14.359ZM5.8908 15.2321L5.7508 18.2551L7.2492 18.3245L7.3892 15.3015L5.8908
                        15.2321ZM5.75396 18.3667C5.83563 19.1586 6.51588 19.7524 7.31152 19.7264L7.26248 18.2272C7.25928
                        18.2273 7.25771 18.2268 7.25669 18.2265C7.25526 18.2259 7.25337 18.2249 7.25144 18.2232C7.2495
                        18.2215 7.24825 18.2198 7.24754 18.2185C7.24703 18.2175 7.24637 18.216 7.24604 18.2128L5.75396
                        18.3667ZM7.45996 19.7065L10.46 18.9955L10.114 17.536L7.11404 18.247L7.45996 19.7065ZM10.4716
                        18.9927C10.7771 18.9151 11.05 18.7422 11.2506 18.499L10.0934 17.5445C10.0958 17.5417 10.0989
                        17.5397 10.1024 17.5388L10.4716 18.9927ZM11.2571 18.491L17.2971 10.959L16.1269 10.0206L10.0869
                        17.5526L11.2571 18.491ZM13.2971 7.95901L14.8851 5.97901L13.7149 5.04052L12.1269 7.02052L13.2971
                        7.95901ZM14.9135 5.94123C15.0521 5.74411 15.3214 5.6912 15.5243 5.82123L16.3337 4.5583C15.4544
                        3.99484 14.2873 4.2241 13.6865 5.0783L14.9135 5.94123ZM15.4492 5.7662L17.6862 7.6282L18.6458
                        6.47532L16.4088 4.61332L15.4492 5.7662ZM17.6352 7.58161C17.7111 7.6577 17.7535 7.761 17.7529
                        7.86852L19.2529 7.87676C19.2557 7.36905 19.0555 6.88127 18.6968 6.52192L17.6352 7.58161ZM17.7529
                        7.86852C17.7524 7.97604 17.7088 8.07886 17.632 8.15412L18.682 9.22541C19.0446 8.87002 19.2501
                        8.38447 19.2529 7.87676L17.7529 7.86852ZM17.5721 8.22025L16.1271 10.0203L17.2969 10.9593L18.7419
                        9.15928L17.5721 8.22025ZM11.9703 7.60091C12.3196 9.93221 14.4771 11.5503 16.813 11.2329L16.611
                        9.74659C15.0881 9.95352 13.6815 8.89855 13.4537 7.37862L11.9703 7.60091Z" fill="currentColor"/>
                    </svg>
                </button>
            </td>
            <td class="icon trash">
                <button class="btn-delete" data-id="${producto.ID_Producto}" data-col="${seccion}">
                    <svg class="trash" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round"/>
                    </svg>
                </button>
            </td>
        </tr>
    `
}

function renderTabla(lista, tbodyId, seccion) {
    const tbody = document.getElementById(tbodyId)
    if (!tbody) return
    tbody.innerHTML = lista.map(producto => crearFila(producto, seccion)).join("")
    tbody.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            editProductoPanel(btn.dataset.id, btn.dataset.col)
        })
    })
    tbody.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            deleteProducto(btn.dataset.id, btn.dataset.col)
        })
    })
}

const form = document.getElementById("form-add-producto")
const addBtn = document.getElementById("nuevo")
const pushBtn = document.getElementById("push")
const delBtn = document.getElementById("del")
const exitBtn = document.getElementById("exit")
const inputImg = document.getElementById("img")

let editando = false
let idEditando = null
let seccionEditando = null

addBtn.addEventListener("click", () => addProductoPanel())
inputImg.addEventListener("input", e => showImg(e.target.value))
pushBtn.addEventListener("click", saveProducto)
delBtn.addEventListener("click", () => {
    if (editando) {
        deleteProducto(idEditando, seccionEditando, true)
    }
})
exitBtn.addEventListener("click", closePanel)
document.addEventListener("keydown", e => {
    if (e.key === "Enter")
        saveProducto()
    if (e.key === "Delete" && editando)
        deleteProducto(idEditando, seccionEditando)
    if (e.key === "Escape")
        closePanel()
})

function addProductoPanel() {
    editando = false
    idEditando = null
    seccionEditando = null
    form.classList.add("act")
    document.getElementById("title").textContent = "Agregar producto"
    pushBtn.textContent = "Agregar"

    document.getElementById("nombre").value = ""
    document.getElementById("precio").value = ""
    document.getElementById("img").value = ""
    document.getElementById("categoria").selectedIndex = 0
    const selectUnidad = document.getElementById("unidad")
    if (selectUnidad) selectUnidad.selectedIndex = 0

    document.getElementById("img-box").innerHTML = ""
}

async function saveProducto() {
    if (editando)
        await editProducto()
    else
        await addProducto()
}

async function addProducto() {
    const nombre = document.getElementById("nombre").value.trim()
    const precio = document.getElementById("precio").value
    const img = document.getElementById("img").value.trim()
    const categoria = document.getElementById("categoria").value
    const unidad = document.getElementById("unidad").value

    if (!nombre || !precio || !categoria) {
        notifyWarning("Completa nombre, precio y categoría")
        return
    }

    const idCategoria = idCategoriaDeSeccion(categoria)
    const idUnidad = unidad ? Number(unidad) : null
    if (!idCategoria || !idUnidad) {
        notifyWarning("Categoría o unidad de medida inválidas")
        return
    }

    const rol = guardRolCheck()
    if (!rol) return

    try {
        const resultado = await productService.crearProducto({
            ID_CategoriaProducto: idCategoria,
            ID_UnidadMedida: idUnidad,
            N_Producto: nombre,
            Precio: Number(precio),
            Costo: 0,
            Imagen: img || null,
            Detalle: null,
            USUCRE: "WEB"
        })
        if (!resultado.ok) {
            console.error("Error al agregar producto:", resultado.error)
            notifyError("No se pudo agregar el producto")
            return
        }
        closePanel()
        iniciarPanel()
    } catch (error) {
        console.error("Error al agregar producto:", error)
    }
}

async function editProductoPanel(id, seccion) {
    const resultado = await productService.listarProductosAdmin()
    if (!resultado.ok) return
    const producto = resultado.data.find(p => String(p.ID_Producto) === String(id))
    if (!producto) return

    editando = true
    idEditando = id
    seccionEditando = seccionDeProducto(producto.ID_CategoriaProducto) || seccion

    form.classList.add("act")
    delBtn.classList.remove("hide-btn")

    document.getElementById("title").textContent = "Producto #" + id
    pushBtn.textContent = "Actualizar"
    document.getElementById("nombre").value = producto.N_Producto || ""
    document.getElementById("precio").value = producto.Precio ?? ""
    document.getElementById("img").value = producto.Imagen || ""
    document.getElementById("categoria").value = seccionEditando
    const selectUnidad = document.getElementById("unidad")
    if (selectUnidad && producto.ID_UnidadMedida != null) {
        selectUnidad.value = String(producto.ID_UnidadMedida)
    }

    showImg(producto.Imagen || "")
}

async function editProducto() {
    const nombre = document.getElementById("nombre").value.trim()
    const precio = document.getElementById("precio").value
    const img = document.getElementById("img").value.trim()
    const unidad = document.getElementById("unidad").value

    if (!nombre || !precio) {
        notifyWarning("Completa nombre y precio")
        return
    }
    if (!guardRolCheck()) return

    const datos = {
        N_Producto: nombre,
        Precio: Number(precio),
        Imagen: img || null,
        USUMOD: "WEB",
        FECMOD: new Date().toISOString()
    }
    if (unidad) {
        datos.ID_UnidadMedida = Number(unidad)
    }

    try {
        const resultado = await productService.actualizarProducto(idEditando, datos)
        if (!resultado.ok) {
            console.error("Error al actualizar producto:", resultado.error)
            notifyError("No se pudo actualizar el producto")
            return
        }
        closePanel()
        iniciarPanel()
    } catch (error) {
        console.error("Error al actualizar producto:", error)
    }
}

function showImg(link) {
    const imgBox = document.getElementById("img-box")
    imgBox.innerHTML = `<img src="${link}" alt="">`
}

const cuerpoConfirmacion = document.createElement("div")
cuerpoConfirmacion.innerHTML = `
    <p>¿Estás seguro de que deseas eliminar este producto?</p>
    <div class="product-info">
        <span id="productName"></span>
        <span id="productCategory"></span>
    </div>
    <p class="warning-text">Esta acción no se puede deshacer.</p>
`

const deleteModal = new Modal({
    title: "Confirmar eliminación",
    actions: [
        { label: "Cancelar", className: "cancel-btn", onClick: () => { pendingDelete = null; deleteModal.close() } },
        { label: "Eliminar", className: "delete-btn", onClick: () => {
            if (pendingDelete) {
                executeDelete(pendingDelete.id)
                pendingDelete = null
            }
        } }
    ]
})
deleteModal.setBody(cuerpoConfirmacion)

const productName = cuerpoConfirmacion.querySelector("#productName")
const productCategory = cuerpoConfirmacion.querySelector("#productCategory")

let pendingDelete = null

async function deleteProducto(id, seccion, usarModal = true) {
    if (!guardRolCheck()) return
    if (usarModal) {
        try {
            const resultado = await productService.listarProductosAdmin()
            if (!resultado.ok) return
            const producto = resultado.data.find(p => String(p.ID_Producto) === String(id))
            productName.textContent = producto ? producto.N_Producto : "Producto sin nombre"
            productCategory.textContent = NOMBRES_SECCION[seccion] || seccion
            pendingDelete = { id, seccion }
            deleteModal.open()
        } catch (error) {
            console.error("Error al cargar producto:", error)
            notifyError("No se pudo cargar la información del producto.")
        }
    } else {
        await executeDelete(id)
    }
}

async function executeDelete(id) {
    try {
        const resultado = await productService.eliminarProducto(id)
        if (!resultado.ok) {
            console.error("Error al eliminar:", resultado.error)
            notifyError("Error al eliminar el producto. Por favor, intenta de nuevo.")
            return
        }
        notifySuccess("Producto eliminado correctamente")
        iniciarPanel()
    } catch (error) {
        console.error("Error al eliminar:", error)
        notifyError("Error al eliminar el producto. Por favor, intenta de nuevo.")
    }
}

function closePanel() {
    form.classList.remove("act")
    editando = false
    idEditando = null
    seccionEditando = null
    delBtn.classList.add("hide-btn")
    document.getElementById("title").textContent = ""
    pushBtn.textContent = "Agregar"
    document.getElementById("nombre").value = ""
    document.getElementById("precio").value = ""
    document.getElementById("img").value = ""
    document.getElementById("categoria").selectedIndex = 0
    const selectUnidad = document.getElementById("unidad")
    if (selectUnidad) selectUnidad.selectedIndex = 0
    document.getElementById("img-box").innerHTML = ""
}

async function guardRolCheck() {
    const roles = await authService.obtenerRoles()
    if (roles.ok && roles.data.includes("ADMINISTRADOR")) return true
    // antes redirigia a si mismo (/admin/panel-carta.html): bucle infinito.
    // admin/dashboard.html todavia no existe, asi que va a la raiz.
    window.location.href = "/index.html"
    return false
}

const tabBebidas = document.getElementById("tab-bebidas")
const tabPostres = document.getElementById("tab-postres")
const tabAperitivos = document.getElementById("tab-aperitivos")

const tablaBebidas = document.getElementById("tabla-bebidas")
const tablaPostres = document.getElementById("tabla-postres")
const tablaAperitivos = document.getElementById("tabla-aperitivos")

const viewCats = {
    tabs: [tabBebidas, tabPostres, tabAperitivos],
    tablas: [tablaBebidas, tablaPostres, tablaAperitivos]
}

function selectTab(id) {
    viewCats.tabs.forEach(tab => tab.classList.remove("act"))
    viewCats.tablas.forEach(tabla => tabla.classList.remove("act"))

    viewCats.tabs[id].classList.add("act")
    viewCats.tablas[id].classList.add("act")
}

viewCats.tabs.forEach((tab, id) => { tab.addEventListener("click", () => selectTab(id)) })

iniciarPanel()
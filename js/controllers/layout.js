import { Navbar } from "../components/Navbar.js"
import { Footer } from "../components/Footer.js"
import { authService } from "../services/authService.js"
import { showMenu, hideMenu } from "../utils/menu.js"
import { opcionalSesion } from "../session/opcionalSesion.js"

const ruta = window.location.pathname
const ROOT = ruta.startsWith("/admin/") ? "../" : "/"

async function cerrarSesion() {
    await authService.logout()
    window.location.href = "/login.html"
}

function destinoNavbar() {
    return document.querySelector("[data-navbar]") || document.body
}

function destinoFooter() {
    return document.querySelector("[data-footer]") || document.body
}

function montarNavbar(sesion) {
    const destino = destinoNavbar()
    const previo = destino.querySelector(".block-menu")

    const navbar = new Navbar({
        session: sesion,
        root: ROOT,
        onSalir: cerrarSesion,
        mostrarCarrito: ruta.toLowerCase().endsWith("menu.html")
    }).render()

    if (previo && previo.parentNode === destino) {
        previo.replaceWith(navbar)
    } else if (destino === document.body) {
        destino.insertBefore(navbar, destino.firstChild)
    } else {
        destino.appendChild(navbar)
    }

    navbar.querySelectorAll(".exis").forEach(boton => boton.addEventListener("click", hideMenu))
    navbar.querySelector("#menu-toggle")?.addEventListener("click", showMenu)

    return navbar
}

function montarFooter() {
    const rutaRaiz = ruta === "/" || ruta.endsWith("/index.html")
    const footer = new Footer({
        root: ROOT,
        copyHref: rutaRaiz ? "admin/login.html" : null
    }).render()

    const destino = destinoFooter()
    if (destino === document.body) {
        destino.appendChild(footer)
    } else {
        destino.replaceChildren(footer)
    }
    return footer
}

export async function iniciarLayout() {
    montarFooter()

    // El navbar se monta UNA vez, con la sesion ya resuelta. Antes se
    // montaba con null y luego se reemplazaba: doble montaje, parpadeo y
    // trabajo tirado. A cambio, el navbar aparece un instante despues.
    const sesion = await opcionalSesion()
    montarNavbar(sesion)

    if (sesion) {
        document.dispatchEvent(new CustomEvent("rodilla:navegacion"))
    }
}
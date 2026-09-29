import { Router } from "../lib/router.js"
import { Navbar } from "../components/Navbar.js"
import { Footer } from "../components/Footer.js"
import { authService } from "../services/authService.js"
import { homeController } from "../views/landing/home.js"
import { menuController } from "../views/landing/menu.js"
import { reservasController } from "../views/landing/reservas.js"
import { contactoController } from "../views/landing/contacto.js"
import { nosotrosController } from "../views/landing/nosotros.js"

/* ==========================================================================
   LANDING — index.html
   --------------------------------------------------------------------------
   Importar cualquiera de estos controladores arrastra carrito.js, que se
   auto-inicializa al importarse y crea el panel del carrito. Por eso
   mostrarCarrito va en true: el boton con el contador ya existe en el
   navbar, no hace falta un boton flotante.
   ========================================================================== */

const RUTAS = {
    "/":         { vista: "landing/home",     controlador: homeController },
    "/menu":     { vista: "landing/menu",     controlador: menuController },
    "/reservas": { vista: "landing/reservas", controlador: reservasController },
    "/contacto": { vista: "landing/contacto", controlador: contactoController },
    "/nosotros": { vista: "landing/nosotros", controlador: nosotrosController },
}

const CLAVE_TEMA = "rodilla:theme"

async function iniciar() {
    const raizNavbar = document.getElementById("navbar-root")

    // El navbar se pinta YA, sin esperar a Supabase. Antes se montaba solo
    // tras el round trip, asi que con la red lenta la cabecera no aparecia
    // hasta que la sesion resolvia (o nunca, si fallaba).
    const pintarNavbar = user => {
        raizNavbar.replaceChildren(
            new Navbar({ session: user, mostrarCarrito: true, onToggleTema: alternarTema }).render()
        )
    }

    /* Misma clave que dashboard.js: la preferencia es de la persona, no de la
       pagina, asi que se guarda y se lee igual en landing y panel. */
    function alternarTema() {
        const html = document.documentElement
        html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark"
        localStorage.setItem(CLAVE_TEMA, html.dataset.theme)
        // El icono del boton es el del tema destino, asi que hay que rehacer
        // la cabecera entera. Sin esto seguiriamos viendo el icono viejo.
        pintarNavbar(ultimoUsuario)
    }

    let ultimoUsuario = null
    pintarNavbar(null)

    document.getElementById("footer-root").replaceChildren(new Footer().render())

    // La vista y la sesion van en paralelo: la una no espera a la otra.
    const router = new Router({ rutas: RUTAS, contenedor: "#app", porDefecto: "/" })
    router.start()

    try {
        const sesion = await authService.obtenerSesion()
        const user = sesion.ok && sesion.data ? sesion.data.user : null
        ultimoUsuario = user
        pintarNavbar(user)
    } catch (error) {
        console.warn("No se pudo leer la sesion:", error)
    }

    window.__router = router
}

iniciar()

import { Router } from "../lib/router.js"
import { iniciarAnalytics } from "../lib/analytics.js"
import { SidebarLanding } from "../components/SidebarLanding.js"
import { TopbarLanding } from "../components/TopbarLanding.js"
import { Footer } from "../components/Footer.js"
import { icon } from "../components/Icon.js"
import { authService } from "../services/authService.js"
import { limpiarSesion } from "../lib/supabaseClient.js"
import { sesionExpirada, limpiarActividad, iniciarVigilanciaInactividad } from "../session/guard.js"
import { homeController } from "../views/landing/home.js"
import { menuController } from "../views/landing/menu.js"
import { reservasController } from "../views/landing/reservas.js"
import { contactoController } from "../views/landing/contacto.js"
import { nosotrosController } from "../views/landing/nosotros.js"

/* ==========================================================================
   LANDING — index.html
   --------------------------------------------------------------------------
   Layout tipo dashboard: sidebar lateral + topbar + main.
   En móvil el sidebar se oculta y se abre con el burger del topbar.
   ========================================================================== */

const RUTAS = {
    "/":         { vista: "landing/home",     controlador: homeController,   titulo: "Inicio" },
    "/menu":     { vista: "landing/menu",     controlador: menuController,   titulo: "Menú" },
    "/reservas": { vista: "landing/reservas", controlador: reservasController, titulo: "Reservas" },
    "/contacto": { vista: "landing/contacto", controlador: contactoController, titulo: "Contacto" },
    "/nosotros": { vista: "landing/nosotros", controlador: nosotrosController, titulo: "Nosotros" },
}

const CLAVE_TEMA = "rodilla:theme"

let sidebar = null
let topbar = null

async function iniciar() {
    // Analytics antes de cualquier otra cosa: el pageview de la vista actual
    // se manda aunque la sesion tarde en resolverse.
    iniciarAnalytics()

    const raizSidebar = document.getElementById("sidebar-root")
    const raizTopbar = document.getElementById("topbar-root")

    // Sidebar y topbar se pintan YA, sin esperar a Supabase.
    function pintarShell({ seccion = "/" } = {}) {
        if (!sidebar) {
            sidebar = new SidebarLanding({ seccion })
            raizSidebar.replaceChildren(sidebar.render())
        } else {
            sidebar.setSeccion(seccion)
        }

        if (!topbar) {
            const titulo = RUTAS[seccion]?.titulo || ""
            topbar = new TopbarLanding({
                titulo,
                onToggleSidebar: () => document.querySelector(".sidebar")?.classList.toggle("sidebar--abierto"),
                onToggleTheme: alternarTema,
                onOpenCarrito: () => document.dispatchEvent(new Event("rodilla:abrir-carrito")),
            })
            raizTopbar.replaceChildren(topbar.render())
        } else {
            const titulo = RUTAS[seccion]?.titulo || ""
            topbar.setTitulo(titulo)
        }
    }

    /* Misma clave que dashboard.js: la preferencia es de la persona, no de la
       pagina, asi que se guarda y se lee igual en landing y panel. */
    function alternarTema() {
        const html = document.documentElement
        html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark"
        localStorage.setItem(CLAVE_TEMA, html.dataset.theme)

        // Actualizar solo el botón de tema, sin re-renderizar todo el topbar
        const btnTema = document.querySelector(".topbar__accion")
        if (btnTema) {
            const oscuro = html.dataset.theme === "dark"
            btnTema.setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro")
            btnTema.title = oscuro ? "Tema claro" : "Tema oscuro"
            btnTema.innerHTML = ""
            const ic = icon(oscuro ? "sun" : "moon", { size: 20 })
            if (ic) btnTema.appendChild(ic)
        }
    }

    // Pintar shell inicial (sección por defecto "/")
    pintarShell({ seccion: "/" })

    document.getElementById("footer-root")?.replaceChildren(new Footer().render())

    // La vista y la sesion van en paralelo: la una no espera a la otra.
    const router = new Router({
        rutas: RUTAS,
        contenedor: "#app",
        porDefecto: "/",
    })
    router.start()

    // Escuchar cambios de hash para actualizar sidebar y topbar
    window.addEventListener("hashchange", () => {
        const ruta = router.obtenerRutaActual()
        pintarShell({ seccion: ruta })
    })

    try {
        let sesion = await authService.obtenerSesion()

        /* Una sesion caducada no debe seguir pintandose como activa: se cierra
           y la landing queda como visita publica. */
        if (sesion.ok && sesion.data && sesionExpirada()) {
            await limpiarSesion()
            limpiarActividad()
            sesion = { ok: true, data: null }
        }

        const user = sesion.ok && sesion.data ? sesion.data.user : null
        if (user) iniciarVigilanciaInactividad()
    } catch (error) {
        console.warn("No se pudo leer la sesion:", error)
    }

    window.__router = router
}

iniciar()
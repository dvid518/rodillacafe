import { Router } from "../lib/router.js"
import { Sidebar } from "../components/Sidebar.js"
import { Topbar } from "../components/Topbar.js"
import { guardSesion } from "../session/guard.js"
import { authService } from "../services/authService.js"
import { panelController } from "../views/dashboard/panel.js"
import { cartaController } from "../views/dashboard/carta.js"
import { categoriasController } from "../views/dashboard/categorias.js"
import { pedidosController } from "../views/dashboard/pedidos.js"
import { reservasController } from "../views/dashboard/reservas.js"
import { mensajesController } from "../views/dashboard/mensajes.js"
import { usuariosController } from "../views/dashboard/usuarios.js"
import { misPedidosController } from "../views/dashboard/mis-pedidos.js"
import { misReservasController } from "../views/dashboard/mis-reservas.js"
import { misMensajesController } from "../views/dashboard/mis-mensajes.js"

/* ==========================================================================
   DASHBOARD — dashboard.html
   --------------------------------------------------------------------------
   Sidebar + topbar + router interno. Las vistas van en el prompt siguiente.

   Sobre el guard: guard.js se auto-invoca al importarse (ultima linea del
   modulo) y ya redirige a /login.html si no hay sesion. Por eso aqui NO se
   vuelve a llamar: seria una segunda peticion a Supabase. Se comprueba el
   resultado de obtenerSesion() y, si no hay, se redirige uno mismo.

   Tampoco se importa userService: no se usa en este prompt.
   ========================================================================== */

const RUTAS = {
    "/dashboard":                { vista: "dashboard/panel",        controlador: panelController },
    "/dashboard/carta":          { vista: "dashboard/carta",        controlador: cartaController },
    "/dashboard/categorias":     { vista: "dashboard/categorias",   controlador: categoriasController },
    "/dashboard/pedidos":        { vista: "dashboard/pedidos",      controlador: pedidosController },
    "/dashboard/reservas":       { vista: "dashboard/reservas",     controlador: reservasController },
    "/dashboard/mensajes":       { vista: "dashboard/mensajes",     controlador: mensajesController },
    "/dashboard/usuarios":       { vista: "dashboard/usuarios",     controlador: usuariosController },
    "/dashboard/mis-pedidos":    { vista: "dashboard/mis-pedidos",  controlador: misPedidosController },
    "/dashboard/mis-reservas":   { vista: "dashboard/mis-reservas", controlador: misReservasController },
    "/dashboard/mis-mensajes":   { vista: "dashboard/mis-mensajes", controlador: misMensajesController },
}

/** Titulo del topbar por ruta. El router pasa ruta.path, sin la barra. */
const TITULOS = {
    "/dashboard":                "Panel",
    "/dashboard/carta":          "Carta",
    "/dashboard/categorias":     "Categorías",
    "/dashboard/pedidos":        "Pedidos",
    "/dashboard/reservas":       "Reservas",
    "/dashboard/mensajes":       "Mensajes",
    "/dashboard/usuarios":       "Usuarios",
    "/dashboard/mis-pedidos":    "Mis pedidos",
    "/dashboard/mis-reservas":   "Mis reservas",
    "/dashboard/mis-mensajes":   "Mis mensajes",
}

const CLAVE_TEMA = "rodilla:theme"

function aplicarTemaGuardado() {
    const guardado = localStorage.getItem(CLAVE_TEMA)
    if (guardado === "dark" || guardado === "light") {
        document.documentElement.dataset.theme = guardado
    }
}

async function iniciar() {
    // import con efecto secundario: guard.js ya redirige solo si no hay sesion
    guardSesion()

    const sesion = await authService.obtenerSesion()
    if (!sesion.ok || !sesion.data) {
        window.location.href = "/auth.html#/login"
        return
    }

    const [perfil, roles] = await Promise.all([
        authService.obtenerPerfil(),
        authService.obtenerRoles(),
    ])

    const listaRoles = roles.ok && Array.isArray(roles.data) ? roles.data : []
    const rolPrincipal = listaRoles[0] || "CLIENTE"
    const user = perfil.ok && perfil.data ? perfil.data : sesion.data.user

    const raizTopbar = document.getElementById("topbar-root")
    let sidebar = null
    let topbar = null
    let tituloActual = TITULOS["/dashboard"]

    const cerrarSesion = async () => {
        await authService.logout()
        window.location.href = "/auth.html#/login"
    }

    const alternarSidebar = () => {
        document.querySelector(".sidebar")?.classList.toggle("sidebar--abierto")
    }

    const alternarTema = () => {
        const html = document.documentElement
        html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark"
        localStorage.setItem(CLAVE_TEMA, html.dataset.theme)
        // el icono del boton cambia sol <-> luna, hay que rehacer ese boton.
        // Se repinta con tituloActual: si no, el toggle de tema dejaria
        // el titulo en "Panel" cada vez que se pulsara.
        pintarTopbar()
    }

    function pintarTopbar() {
        topbar = new Topbar({
            user,
            titulo: tituloActual,
            onLogout: cerrarSesion,
            onToggleSidebar: alternarSidebar,
            onToggleTheme: alternarTema,
        })
        raizTopbar.replaceChildren(topbar.render())
    }

    sidebar = new Sidebar({
        seccion: null,
        rol: rolPrincipal,
        onLogout: cerrarSesion,
    })
    document.getElementById("sidebar-root").replaceChildren(sidebar.render())
    pintarTopbar()

    const router = new Router({ rutas: RUTAS, contenedor: "#app", porDefecto: "/dashboard" })

    // al navegar se resaltan el item del sidebar y el titulo del topbar
    const marcar = () => {
        const ruta = router.obtenerRutaActual()
        sidebar.setSeccion(ruta)
        const titulo = TITULOS[ruta]
        if (titulo && titulo !== tituloActual) {
            tituloActual = titulo
            topbar.setTitulo(titulo)
        }
    }
    window.addEventListener("hashchange", marcar)
    router.start()
    marcar()

    aplicarTemaGuardado()
    window.__router = router
}

iniciar()

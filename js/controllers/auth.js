import { Router } from "../lib/router.js"
import { loginController } from "../views/auth/login.js"
import { registerController } from "../views/auth/register.js"

/* ==========================================================================
   AUTH — auth.html (login + register)
   --------------------------------------------------------------------------
   No lleva navbar ni footer a proposito: es una pantalla de paso.

   No se importa session/guard.js aqui a proposito: ese modulo se
   auto-invoca al importarse y, como auth.html esta en su lista de paginas
   publicas, expulsaria al visitante de la propia pagina que esta pintando.
   ========================================================================== */

const RUTAS = {
    "/login":    { vista: "auth/login",    controlador: loginController },
    "/register": { vista: "auth/register", controlador: registerController },
}

function iniciar() {
    if (!window.location.hash) {
        window.location.hash = "#/login"
    }

    const router = new Router({ rutas: RUTAS, contenedor: "#app", porDefecto: "/login" })
    router.start()
}

iniciar()

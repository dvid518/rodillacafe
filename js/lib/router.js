/* ==========================================================================
   ROUTER — hash based, sin dependencias
   --------------------------------------------------------------------------
   Convierte #/algo en contenido de views/<algo>.html dentro de un contenedor.

   Decisiones sobre la version basica del enunciado:

   - teardown(): innerHTML = "" NO llama al destructor de la vista anterior.
     Si un controlador registra listeners (click, scroll, setInterval) se
     quedan vivos y se acumulan en cada navegacion. Por eso el controlador
     puede devolver una funcion de limpieza, que se ejecuta al salir.

   - ruta desconocida: la version basia hacia caer en silencio sobre la vista
     por defecto y ademas guardaba this.actual = ruta (la pedida, no la
     cargada). Aqui se distingue: se avisa por consola, se carga la de
     defecto, y this.actual guarda la ruta REALMENTE cargada.

   - fetch necesita http(s). Abierto con file:// el navegador bloquea las
     peticiones a archivos locales y todas las vistas fallan.
   ========================================================================== */

const BASE_VISTAS = "views/"

export class Router {
    constructor({ rutas, contenedor, porDefecto = "/" } = {}) {
        this.rutas = rutas || {}
        this.contenedor = contenedor
        this.porDefecto = porDefecto
        this.actual = null
        this.limpieza = null
        this._enHashchange = () => this.navigate(this.obtenerRutaActual())
    }

    obtenerRutaActual() {
        const hash = window.location.hash.replace(/^#/, "")
        return hash || this.porDefecto
    }

    /** Ejecuta la limpieza que dejo la vista anterior, si dejo alguna. */
    _limpiar() {
        if (typeof this.limpieza === "function") {
            try {
                this.limpieza()
            } catch (error) {
                console.error("Error en el teardown de la vista:", error)
            }
        }
        this.limpieza = null
    }

    async navigate(ruta) {
        const pedida = ruta
        let entrada = this.rutas[pedida]

        if (!entrada) {
            console.warn(`[Router] ruta sin definir: "${pedida}" -> cae en "${this.porDefecto}"`)
            entrada = this.rutas[this.porDefecto]
        }
        if (!entrada) return

        this.actual = pedida

        const nodo = document.querySelector(this.contenedor)
        if (!nodo) {
            console.error(`[Router] no existe el contenedor: ${this.contenedor}`)
            return
        }

        this._limpiar()

        try {
            const respuesta = await fetch(`${BASE_VISTAS}${entrada.vista}.html`)
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al pedir ${entrada.vista}`)
            nodo.innerHTML = await respuesta.text()

            if (typeof entrada.controlador === "function") {
                const limpieza = await entrada.controlador(nodo)
                if (typeof limpieza === "function") this.limpieza = limpieza
            }

            nodo.scrollIntoView?.({ block: "start" })
        } catch (error) {
            console.error("Error en router:", error)
            nodo.innerHTML =
                '<p class="router-error">No se pudo cargar la vista. Revisa la consola.</p>'
        }
    }

    start() {
        window.addEventListener("hashchange", this._enHashchange)
        this.navigate(this.obtenerRutaActual())
    }

    stop() {
        window.removeEventListener("hashchange", this._enHashchange)
        this._limpiar()
    }

    static irA(ruta) {
        if (window.location.hash === `#${ruta}`) return
        window.location.hash = ruta
    }
}

export default Router

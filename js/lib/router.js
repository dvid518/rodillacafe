/* ==========================================================================
   ROUTER — History API (pushState), sin dependencias
   --------------------------------------------------------------------------
   Convierte /algo en contenido de views/<algo>.html dentro de un contenedor.
   Usa history.pushState en lugar de hash, así las URLs quedan limpias:
     http://localhost:8000/dashboard/ventas
   en vez de:
     http://localhost:8000/dashboard.html#/dashboard/ventas

   Requisito del servidor: debe servir dashboard.html (o index.html, auth.html)
   para cualquier ruta bajo su sección, p. ej. /dashboard/* -> dashboard.html.
   En Vercel se logra con vercel.json (rewrite). En desarrollo local, una
   regla de 404.html puede hacer el fallback al SPA.

   Decisiones:
   - ruta desconocida: avisa por consola, carga la por defecto, y this.actual
     guarda la ruta REALMENTE cargada.
   - barras finales: se normalizan (elimina "/" al final excepto en la raíz).
   - fetch necesita http(s). Abierto con file:// el navegador bloquea peticiones
     a archivos locales y todas las vistas fallan.
   ========================================================================== */

const BASE_VISTAS = "views/"

/** Elimina barra final excepto en la raíz "/" y extensión .html. */
function normalizarRuta(ruta) {
    if (ruta.endsWith(".html")) {
        ruta = ruta.slice(0, -5)
    }
    if (ruta.length > 1 && ruta.endsWith("/")) {
        return ruta.slice(0, -1)
    }
    return ruta
}

/** Convierte una ruta con parámetros (:id, :slug, etc.) en una RegExp
    que extrae los valores capturados. Ejemplo:
      ruta: "/dashboard/pedido/:id"
      pathname: "/dashboard/pedido/201"
      resultado: { match: true, params: { id: "201" } }
*/
function hacerMatcherRuta(rutaPatron) {
    const segmentos = rutaPatron.split("/").filter(s => s.length > 0)
    const partesRegex = []
    const nombresParams = []

    for (const seg of segmentos) {
        if (seg.startsWith(":")) {
            const nombre = seg.slice(1)
            nombresParams.push(nombre)
            partesRegex.push("([^/]+)")
        } else {
            partesRegex.push(seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        }
    }

    const regex = new RegExp("^" + partesRegex.join("/") + "$")

    return {
        matcher: (pathname) => {
            const m = pathname.match(regex)
            if (!m) return null
            const params = {}
            nombresParams.forEach((nombre, i) => {
                params[nombre] = m[i + 1]
            })
            return { params }
        },
        patron: rutaPatron
    }
}

export class Router {
    constructor({ rutas, contenedor, porDefecto = "/" } = {}) {
        this.rutas = rutas || {}
        this.contenedor = contenedor
        this.porDefecto = normalizarRuta(porDefecto)
        this.actual = null
        this.limpieza = null
        this.navegando = false  // evita navegaciones dobles concurrentes
        this._enPopstate = () => this.navigate(this.obtenerRutaActual())
    }

    obtenerRutaActual() {
        let ruta = window.location.pathname
        if (!ruta || ruta === "/") return this.porDefecto
        return normalizarRuta(ruta)
    }

    /** Ejecuta la limpieza que dejó la vista anterior, si dejó alguna. */
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

    /** Resuelve una ruta contra el mapa de rutas, soportando parámetros
        dinámicos (:id, :slug, etc.). Devuelve { entrada, params } o null. */
    resolverRuta(ruta) {
        // Búsqueda exacta primero
        if (this.rutas[ruta]) {
            return { entrada: this.rutas[ruta], params: {} }
        }

        // Búsqueda con parámetros dinámicos
        for (const [patron, entrada] of Object.entries(this.rutas)) {
            const matcher = hacerMatcherRuta(patron)
            const resultado = matcher.matcher(ruta)
            if (resultado) {
                return { entrada, params: resultado.params }
            }
        }

        return null
    }

    async navigate(ruta, reemplazar = false) {
        const pedida = normalizarRuta(ruta)

        // Evitar navegación doble: si ya estamos navegando, ignorar
        if (this.navegando) return

        // Evitar navegar a la misma ruta que ya está cargada
        if (pedida === this.actual && !reemplazar) return

        let resolucion = this.resolverRuta(pedida)

        if (!resolucion) {
            console.warn(`[Router] ruta sin definir: "${pedida}" -> cae en "${this.porDefecto}"`)
            resolucion = this.resolverRuta(this.porDefecto)
        }

        if (!resolucion) return

        this.actual = resolucion.entrada.patron || pedida  // guarda el patrón de ruta, no la URL cruda

        // Sincroniza la URL del navegador sin recargar la página
        if (reemplazar) {
            history.replaceState(null, "", pedida)
        } else {
            history.pushState(null, "", pedida)
        }

        const nodo = document.querySelector(this.contenedor)
        if (!nodo) {
            console.error(`[Router] no existe el contenedor: ${this.contenedor}`)
            return
        }

        this.navegando = true
        this._limpiar()

        try {
            const respuesta = await fetch(`${BASE_VISTAS}${resolucion.entrada.vista}.html`)
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al pedir ${resolucion.entrada.vista}`)
            nodo.innerHTML = await respuesta.text()

            if (typeof resolucion.entrada.controlador === "function") {
                const limpieza = await resolucion.entrada.controlador(nodo, resolucion.params)
                if (typeof limpieza === "function") this.limpieza = limpieza
            }

            nodo.scrollIntoView?.({ block: "start" })
        } catch (error) {
            console.error("Error en router:", error)
            nodo.innerHTML =
                '<p class="router-error">No se pudo cargar la vista. Revisa la consola.</p>'
        } finally {
            this.navegando = false
        }
    }

    start() {
        // Navega a la ruta actual al iniciar
        this.navigate(this.obtenerRutaActual(), true)
        window.addEventListener("popstate", this._enPopstate)
    }

    stop() {
        window.removeEventListener("popstate", this._enPopstate)
        this._limpiar()
    }

    /** Navega programáticamente a una ruta (ej. desde un botón del sidebar). */
    irA(ruta) {
        const normalizada = normalizarRuta(ruta)
        const urlDestino = normalizada === "/" ? "/" : normalizada
        if (window.location.pathname === urlDestino) return
        history.pushState(null, "", urlDestino)
        window.dispatchEvent(new PopStateEvent("popstate"))
    }
}

export default Router

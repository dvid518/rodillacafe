/* ==========================================================================
   ANALYTICS — Vercel Web Analytics
   --------------------------------------------------------------------------
   Por que NO `import { Analytics } from "@vercel/analytics/next"`:
   ese entrypoint es un componente de React que necesita el runtime de Next.js
   (app router). Este proyecto no es Next.js: son 3 paginas HTML estaticas,
   modulos ES nativos y cero dependencias npm (ver docs/ARQUITECTURA.md, 2.1).
   La variante que si aplica es la que Vercel documenta para sitios HTML
   planos: un stub de `window.va` + el script que sirve el propio despliegue
   en /_vercel/insights/script.js. No hay nada que instalar.

   Requisitos, en el panel de Vercel (project > Analytics):
     1. Pulsar "Enable". Sin esto, /_vercel/insights/script.js responde 404
        y no se registra nada.
     2. Redesplegar: las rutas de analytics solo existen en el despliegue
        siguiente a la activacion.

   Que aporta este modulo ademas de cargar el script:
   El router del proyecto es hash-based (/#/menu, /dashboard.html#/dashboard/carta)
   y el script de Vercel solo cuenta cambios de PATH (pushState/popstate): un
   cambio de hash no genera pageview. Sin lo de aqui, el panel mostraria tres
   paginas (/, /auth, /dashboard) y ninguna seccion. Este modulo convierte
   cada ruta del hash en un pageview con su path real.

   El auto-track del script se desactiva (data-disable-auto-track) porque
   manda un pageview al cargar con la ruta del DOCUMENTO, no la de la RUTA:
   /auth.html#/login se contaria como /auth.html en vez de /auth/login. Aqui
   los pageviews los manda solo este modulo: uno por vista, con el mismo
   criterio siempre.
   ========================================================================== */

/** Script de tracking. Lo sirve el propio despliegue cuando Analytics esta activo. */
const SRC_SCRIPT = "/_vercel/insights/script.js"

/** En local no se manda nada: el trafico de desarrollo ensuciaria el panel. */
const ES_LOCAL = typeof window !== "undefined"
    && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)

/** Ultima ruta enviada, para no contar dos veces la misma vista. */
let ultimaRuta = null

/**
 * Prepara el stub de window.va.
 *
 * El script real de Vercel sustituye esta funcion por la suya y reproduce la
 * cola (window.vaq), asi que se puede llamar a va() antes de que el script
 * cargue: las llamadas quedan encoladas y se envian cuando llega.
 */
function prepararStub() {
    if (typeof window.va === "function") return
    window.va = function () {
        (window.vaq = window.vaq || []).push(arguments)
    }
}

/**
 * Carga el script de Vercel. Se hace una sola vez por documento.
 *
 * El script se inserta desde aqui (y no va como <script> en el HTML) para que
 * el stub, el criterio de rutas y el auto-track desactivado vivan en un solo
 * sitio, en vez de repetidos en los 3 HTML raiz.
 */
function cargarScript() {
    if (document.querySelector(`script[src="${SRC_SCRIPT}"]`)) return
    const script = document.createElement("script")
    script.src = SRC_SCRIPT
    // Sin auto-track: los pageviews los manda este modulo (ver cabecera).
    script.dataset.disableAutoTrack = "true"
    document.head.appendChild(script)
}

/**
 * Nombre de la pagina actual: "index", "auth", "dashboard"...
 * Sale del propio archivo (index.html, auth.html, dashboard.html).
 */
function nombrePagina() {
    const archivo = window.location.pathname.split("/").pop() || ""
    return archivo.replace(/\.html$/i, "") || "index"
}

/**
 * Ruta que se registra para la vista actual:
 *
 *   index.html (home)                    -> /
 *   index.html#/menu                     -> /menu
 *   auth.html#/login                     -> /auth/login
 *   dashboard.html#/dashboard/carta      -> /dashboard/carta
 *
 * El prefijo es el de la pagina, salvo en la landing, que vive en la raiz. En
 * el panel las rutas ya empiezan por /dashboard, asi que no se duplica.
 *
 * @returns {string}
 */
export function rutaActual() {
    const hash = window.location.hash.replace(/^#/, "")
    const ruta = hash || "/"
    const pagina = nombrePagina()
    if (pagina === "index") return ruta
    const prefijo = `/${pagina}`
    if (ruta === "/") return prefijo
    return ruta.startsWith(prefijo) ? ruta : `${prefijo}${ruta}`
}

/**
 * Envia el pageview de la vista actual.
 *
 * `path` es la ruta que se registra; `route` es la misma ruta como etiqueta de
 * agrupacion, que es lo que usa Vercel para ordenar las paginas del panel.
 * Se ignoran las vistas repetidas: entrar dos veces seguidas en la misma ruta
 * no son dos visitas.
 */
export function enviarPageView() {
    if (typeof window.va !== "function") return
    const ruta = rutaActual()
    if (ruta === ultimaRuta) return
    ultimaRuta = ruta
    try {
        window.va("pageview", { path: ruta, route: ruta })
    } catch (error) {
        console.warn("[analytics] no se pudo enviar el pageview:", error)
    }
}

/**
 * Envia un evento de accion: `evento("Pedido", { total: 42 })`.
 * Los eventos personalizados solo existen en los planes Pro y Enterprise.
 *
 * @param {string} nombre
 * @param {Object} [datos]
 */
export function evento(nombre, datos = {}) {
    if (typeof window.va !== "function") return
    try {
        window.va("event", { name: nombre, data: datos })
    } catch (error) {
        console.warn("[analytics] no se pudo enviar el evento:", error)
    }
}

/**
 * Arranca la integracion. La llama el controlador de cada pagina (los 3
 * puntos de entrada) una sola vez, al principio.
 */
export function iniciarAnalytics() {
    if (typeof window === "undefined" || ES_LOCAL) return
    prepararStub()
    cargarScript()
    // El router avisa con hashchange: ahi se manda el pageview de la vista.
    window.addEventListener("hashchange", enviarPageView)
    enviarPageView()
}

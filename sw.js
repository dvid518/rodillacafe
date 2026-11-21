/* ==========================================================================
   SERVICE WORKER — Rodilla PWA
   --------------------------------------------------------------------------
   Estrategia:
   - Navegación y módulos propios (HTML, JS, CSS): RED PRIMERO, caché como
     respaldo offline. Así un despliegue se ve en la siguiente carga sin
     depender de subir CACHE_NAME a mano.
   - Imágenes y resto de estáticos propios: caché primero.
   - Recursos externos conocidos (CDN, fuentes): caché primero.
   - Supabase / API: siempre red (network-only), nunca se cachean datos
     personales ni respuestas del backend.
   - No se implementan colas de ventas offline ni sincronización de
     transacciones en esta fase.
   ========================================================================== */

const CACHE_NAME = "rodilla-v3"
const APP_SHELL = [
    "/",
    "/index.html",
    "/auth.html",
    "/dashboard.html",
    "/manifest.webmanifest",
    "/css/style.css",
    "/css/base/reset.css",
    "/css/base/typography.css",
    "/css/components/components.css",
    "/css/components/hero.css",
    "/css/components/navigation.css",
    "/css/components/modal.css",
    "/css/components/skeleton.css",
    "/css/components/sidebar.css",
    "/css/components/topbar.css",
    "/css/pages/landing.css",
    "/css/pages/auth.css",
    "/css/pages/dashboard.css",
    "/js/config.js",
    "/js/lib/router.js",
    "/js/lib/supabaseClient.js",
    "/js/lib/analytics.js",
    "/js/utils/format.js",
    "/js/utils/notify.js",
    "/js/utils/ticket.js",
    "/js/utils/supabaseHelpers.js",
    "/js/components/Icon.js",
    "/js/components/Sidebar.js",
    "/js/components/Topbar.js",
    "/js/components/Modal.js",
    "/js/components/Notification.js",
    "/js/components/Card.js",
    "/js/components/Footer.js",
    "/js/components/Loading.js",
    "/js/components/Navbar.js",
    "/js/controllers/auth.js",
    "/js/controllers/dashboard.js",
    "/js/controllers/landing.js",
    "/js/views/dashboard/ventas.js",
    "/js/views/dashboard/aperturaCaja.js",
]

// Recursos externos cacheables (CDN y fuentes). Se cachean por separado
// para no fallar la instalación si uno no responde.
const EXTERNAL_CACHE = [
    "https://fonts.googleapis.com/css2?family=Miranda+Sans:ital,wght@0,400..700;1,400..700&display=swap",
    "https://fonts.gstatic.com/",
    "https://unpkg.com/reicon@1.2.4/cdn/reicon.js",
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
]

self.addEventListener("install", (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
            caches.open(CACHE_NAME + "-external").then((cache) =>
                cache.addAll(EXTERNAL_CACHE).catch((err) => {
                    console.warn("[SW] Algunos recursos externos no se cachearon:", err)
                })
            ),
        ]).then(() => self.skipWaiting())
    )
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME && key !== CACHE_NAME + "-external").map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    )
})

/* Red primero: devuelve lo fresco y lo guarda. Sin red, sirve la copia.
   El fallback solo se usa en navegación (p. ej. /dashboard.html sin visitar). */
async function redPrimero(request, fallbackUrl) {
    const cache = await caches.open(CACHE_NAME)
    try {
        const respuesta = await fetch(request)
        if (respuesta.ok) cache.put(request, respuesta.clone())
        return respuesta
    } catch (error) {
        const copia = await cache.match(request)
        if (copia) return copia
        if (fallbackUrl) {
            const respaldo = await cache.match(fallbackUrl)
            if (respaldo) return respaldo
        }
        throw error
    }
}

async function cachePrimero(request) {
    const cache = await caches.open(CACHE_NAME)
    const copia = await cache.match(request)
    if (copia) return copia
    const respuesta = await fetch(request)
    if (respuesta.ok) cache.put(request, respuesta.clone())
    return respuesta
}

self.addEventListener("fetch", (event) => {
    const { request } = event
    if (request.method !== "GET") return

    const url = new URL(request.url)

    // Supabase y API: siempre red, nunca caché (datos personales / backend).
    if (url.hostname.endsWith(".supabase.co") || url.hostname === "api.factiliza.com") {
        event.respondWith(fetch(request))
        return
    }

    if (url.origin === self.location.origin) {
        // Navegación: red primero para no clavar un HTML viejo.
        if (request.mode === "navigate") {
            event.respondWith(redPrimero(request, "/index.html"))
            return
        }
        // Módulos y estilos: red primero, caché como respaldo offline.
        if (/\.(?:m?js|css)$/.test(url.pathname)) {
            event.respondWith(redPrimero(request))
            return
        }
        // Imágenes y demás estáticos propios: caché primero.
        event.respondWith(cachePrimero(request))
        return
    }

    // CDN externos conocidos: caché primero.
    event.respondWith(cachePrimero(request))
})

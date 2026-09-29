/* Verificacion estatica del prompt 4a.
   Comprueba, sin navegador y sin sesion de admin:
     1. que todo import de los archivos nuevos resuelva a un archivo real
     2. que cada querySelector/getElementById de los controladores encuentre
        un id en la vista correspondiente (el fallo tipico: id mal escrito)
     3. que las 10 vistas existan y que las 3 de contenido tengan los ids
        que el router y los controladores necesitan
   Uso: node work/verificar-prompt4.mjs
*/
import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

const RAIZ = resolve(process.argv[2] || ".")
let fallos = 0
let checks = 0

function ok(msg) { checks++; console.log(`  PASA  ${msg}`) }
function fail(msg) { checks++; fallos++; console.log(`  FALLA ${msg}`) }

/* ---------- 1. imports ---------- */

const ARCHIVOS = [
    "js/views/dashboard/panel.js",
    "js/views/dashboard/carta.js",
    "js/views/dashboard/categorias.js",
    "js/controllers/dashboard.js",
]

console.log("\n== 1. imports resuelven ==")
for (const rel of ARCHIVOS) {
    const ruta = resolve(RAIZ, rel)
    if (!existsSync(ruta)) { fail(`${rel} no existe`); continue }
    const fuente = readFileSync(ruta, "utf8")
    const imports = [...fuente.matchAll(/from\s+["'](\.[^"']+)["']/g)].map(m => m[1])
    const rotos = imports.filter(spec => !existsSync(resolve(dirname(ruta), spec)))
    if (rotos.length) fail(`${rel} importa mal: ${rotos.join(", ")}`)
    else ok(`${rel}: ${imports.length} imports resuelven`)
}

/* ---------- 2. ids que piden los controladores ---------- */

const PARES = [
    ["js/views/dashboard/panel.js", "views/dashboard/panel.html"],
    ["js/views/dashboard/carta.js", "views/dashboard/carta.html"],
    ["js/views/dashboard/categorias.js", "views/dashboard/categorias.html"],
]

console.log("\n== 2. selectores de los controladores existen en su vista ==")
for (const [jsRel, htmlRel] of PARES) {
    const js = readFileSync(resolve(RAIZ, jsRel), "utf8")
    const html = readFileSync(resolve(RAIZ, htmlRel), "utf8")
    const idsHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))
    const pedidos = new Set()
    for (const m of js.matchAll(/(?:querySelector|getElementById)\(\s*["']#?([A-Za-z][\w-]*)["']\s*\)/g)) {
        pedidos.add(m[1])
    }
    const faltan = [...pedidos].filter(id => !idsHtml.has(id))
    if (faltan.length) fail(`${jsRel} busca ${faltan.length} id(s) inexistente(s): ${faltan.join(", ")}`)
    else ok(`${jsRel}: los ${pedidos.size} ids buscados existen en ${htmlRel}`)
}

/* ---------- 3. estructura de vistas ---------- */

console.log("\n== 3. las 10 vistas parciales ==")
const RUTAS = [
    "panel", "carta", "categorias", "pedidos", "reservas", "mensajes",
    "usuarios", "mis-pedidos", "mis-reservas", "mis-mensajes",
]
for (const r of RUTAS) {
    const p = resolve(RAIZ, "views/dashboard", `${r}.html`)
    if (!existsSync(p)) { fail(`views/dashboard/${r}.html falta`); continue }
    const c = readFileSync(p, "utf8").trim()
    if (!c.startsWith("<section")) { fail(`${r}.html no empieza por <section>`); continue }
    ok(`views/dashboard/${r}.html`)
}

console.log("\n== 4. RUTAS del router == cada ruta tiene vista ==")
const dash = readFileSync(resolve(RAIZ, "js/controllers/dashboard.js"), "utf8")
for (const r of RUTAS) {
    const ruta = r === "panel" ? "/dashboard" : `/dashboard/${r}`
    if (!dash.includes(`"${ruta}"`)) { fail(`RUTAS no incluye ${ruta}`); continue }
    ok(`RUTAS incluye ${ruta}`)
}

console.log("\n== 5. los 3 controladores estan cableados ==")
for (const [nombre, fn] of [["panel", "panelController"], ["carta", "cartaController"], ["categorias", "categoriasController"]]) {
    if (!dash.includes(`import { ${fn} } from "../views/dashboard/${nombre}.js"`)) {
        fail(`falta el import de ${fn}`)
        continue
    }
    if (!new RegExp(`${fn}\\s*}`).test(dash)) { fail(`${fn} no aparece en RUTAS`); continue }
    ok(`${fn} importado y asignado`)
}

console.log("\n== 6. TITULOS cubre las 10 rutas ==")
const bloque = dash.match(/const TITULOS = \{([\s\S]*?)\}/)
if (!bloque) { fail("no hay mapa TITULOS") } else {
    for (const r of RUTAS) {
        const ruta = r === "panel" ? "/dashboard" : `/dashboard/${r}`
        if (!bloque[1].includes(`"${ruta}"`)) fail(`TITULOS no cubre ${ruta}`)
    }
    ok("TITULOS cubre las 10 rutas")
}

console.log("\n== 7. categoryService expone el CRUD ==")
const cat = readFileSync(resolve(RAIZ, "js/services/categoryService.js"), "utf8")
for (const fn of ["crearCategoria", "actualizarCategoria", "eliminarCategoria"]) {
    if (!cat.includes(fn)) fail(`categoryService no expone ${fn}`)
}
ok("categoryService expone crear/actualizar/eliminar")

const catAd = readFileSync(resolve(RAIZ, "js/adapters/CategoryAdapter.js"), "utf8")
for (const fn of ["crear", "actualizar", "eliminar"]) {
    if (!new RegExp(`async function ${fn}\\(`).test(catAd)) fail(`CategoryAdapter no define ${fn}`)
}
ok("CategoryAdapter define crear/actualizar/eliminar")

/* ---------- resumen ---------- */
console.log(`\n${fallos === 0 ? "VEREDICTO: TODO OK" : `VEREDICTO: ${fallos} FALLO(S)`}  (${checks} checks)`)
process.exit(fallos === 0 ? 0 : 1)

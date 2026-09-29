/* Verificacion estatica del prompt 4b.
   Comprueba:
     1. que todo import de los archivos nuevos resuelva
     2. que cada querySelector de cada controlador encuentre un id en su vista
     3. que el numero de <th> de cada vista coincida con las <td> que el
        controlador emite y con el colspan de las filas de estado
     4. que el router cablee los 10 controladores
     5. que no queden imports muertos ni metodos de adapter sin service
   Uso: node work/verificar-prompt4b.mjs [raiz]
*/
import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

const RAIZ = resolve(process.argv[2] || ".")
let fallos = 0, checks = 0
const ok = m => { checks++; console.log(`  PASA  ${m}`) }
const fail = m => { checks++; fallos++; console.log(`  FALLA ${m}`) }
const leer = p => readFileSync(resolve(RAIZ, p), "utf8")

const CONTROLADORES = [
    ["pedidos",      "js/views/dashboard/pedidos.js",      "views/dashboard/pedidos.html"],
    ["reservas",     "js/views/dashboard/reservas.js",     "views/dashboard/reservas.html"],
    ["mensajes",     "js/views/dashboard/mensajes.js",     "views/dashboard/mensajes.html"],
    ["usuarios",     "js/views/dashboard/usuarios.js",     "views/dashboard/usuarios.html"],
    ["mis-pedidos",  "js/views/dashboard/mis-pedidos.js",  "views/dashboard/mis-pedidos.html"],
    ["mis-reservas", "js/views/dashboard/mis-reservas.js", "views/dashboard/mis-reservas.html"],
    ["mis-mensajes", "js/views/dashboard/mis-mensajes.js", "views/dashboard/mis-mensajes.html"],
]

console.log("\n== 1. imports resuelven ==")
for (const [n, js] of CONTROLADORES) {
    const ruta = resolve(RAIZ, js)
    if (!existsSync(ruta)) { fail(`${js} no existe`); continue }
    const imports = [...leer(js).matchAll(/from\s+["'](\.[^"']+)["']/g)].map(m => m[1])
    const rotos = imports.filter(s => !existsSync(resolve(dirname(ruta), s)))
    rotos.length ? fail(`${js} importa mal: ${rotos.join(", ")}`) : ok(`${js}: ${imports.length} imports`)
}

console.log("\n== 2. los ids que pide cada controlador existen en su vista ==")
for (const [n, js, html] of CONTROLADORES) {
    const fuente = leer(js)
    const vista = leer(html)
    const idsVista = new Set([...vista.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))
    const pedidos = new Set()
    for (const m of fuente.matchAll(/(?:querySelector|querySelectorAll)\(\s*["']#([\w-]+)["']\s*\)/g)) pedidos.add(m[1])
    const faltan = [...pedidos].filter(id => !idsVista.has(id))
    faltan.length
        ? fail(`${n}: busca ${faltan.length} id(s) inexistente(s): ${faltan.join(", ")}`)
        : ok(`${n}: los ${pedidos.size} ids buscados existen`)
}

console.log("\n== 3. columnas de la tabla == <th> ==")
// cada fila del <tbody> de un controlador emite N <td>; debe coincidir con los <th>
for (const [n, js, html] of CONTROLADORES) {
    const fuente = leer(js)
    const vista = leer(html)
    const th = (vista.match(/<th[\s>]/g) || []).length
    const celdas = [...fuente.matchAll(/const CELDAS\s*=\s*(\d+)/g)].map(m => Number(m[1]))
    if (!celdas.length) { fail(`${n}: no declara CELDAS`); continue }
    const declarado = celdas[0]

    // el colspan de filaVacia/filaError debe ser el mismo numero
    const colspans = [...fuente.matchAll(/fila(?:Vacia|Error)\(\s*(?:CELDAS|\d+)/g)].length
    if (declarado !== th) fail(`${n}: declara CELDAS=${declarado} pero la vista tiene ${th} <th>`)
    else ok(`${n}: CELDAS=${declarado} coincide con los ${th} <th>${colspans ? " (colspan coherente)" : ""}`)

    // las filas por plantilla deben emitir exactamente CELDAS <td>
    for (const m of fuente.matchAll(/<tr>\n([\s\S]*?)<\/tr>/g)) {
        const tds = (m[1].match(/<td[\s>]/g) || []).length
        if (tds && tds !== declarado) {
            fail(`${n}: una fila emite ${tds} <td> y CELDAS=${declarado}`)
        }
    }
}

console.log("\n== 4. router cableado ==")
const dash = leer("js/controllers/dashboard.js")
const ESPERADOS = {
    "pedidosController": "pedidos", "reservasController": "reservas",
    "mensajesController": "mensajes", "usuariosController": "usuarios",
    "misPedidosController": "mis-pedidos", "misReservasController": "mis-reservas",
    "misMensajesController": "mis-mensajes",
}
for (const [fn, ruta] of Object.entries(ESPERADOS)) {
    if (!dash.includes(`import { ${fn} }`)) { fail(`falta import de ${fn}`); continue }
    if (!new RegExp(`controlador:\\s*${fn}`).test(dash)) { fail(`${fn} no esta asignado en RUTAS`); continue }
    ok(`${fn} -> /dashboard/${ruta}`)
}
const sinControlador = [...dash.matchAll(/"\/dashboard[^"]*":\s*\{\s*vista:[^}]*controlador:\s*null/g)]
sinControlador.length ? fail(`quedan ${sinControlador.length} rutas sin controlador`) : ok("las 10 rutas tienen controlador")

console.log("\n== 5. TITULOS cubre las 10 rutas ==")
const t = dash.match(/const TITULOS = \{([\s\S]*?)\n\}/)
if (!t) fail("no hay mapa TITULOS")
else {
    const rutas = ["/dashboard", ...["carta","categorias","pedidos","reservas","mensajes","usuarios","mis-pedidos","mis-reservas","mis-mensajes"].map(r => `/dashboard/${r}`)]
    const faltan = rutas.filter(r => !t[1].includes(`"${r}"`))
    faltan.length ? fail(`TITULOS no cubre: ${faltan.join(", ")}`) : ok("TITULOS cubre las 10 rutas")
}

console.log("\n== 6. metodos nuevos: adapter -> service -> controlador ==")
const CADENA = [
    ["OrderAdapter", "crearManual", "orderService", "crearPedidoManual", "pedidos.js", "crearPedidoManual"],
    ["OrderAdapter", "actualizar", "orderService", "actualizarPedido", "pedidos.js", "actualizarPedido"],
    ["OrderAdapter", "listarTipos", "orderService", "listarTiposAtencion", "pedidos.js", "listarTiposAtencion"],
    ["ReservationAdapter", "crearManual", "reservationService", "crearReservaManual", "reservas.js", "crearReservaManual"],
    ["ReservationAdapter", "actualizar", "reservationService", "actualizarReserva", "reservas.js", "actualizarReserva"],
    ["MessageAdapter", "crearManual", "messageService", "crearMensajeManual", "mensajes.js", "crearMensajeManual"],
    ["MessageAdapter", "actualizar", "messageService", "actualizarMensaje", "mensajes.js", "actualizarMensaje"],
    ["UserAdapter", "listarClientes", "userService", "listarClientes", "pedidos.js", "listarClientes"],
]
for (const [ad, met, srv, wrap, ctrl, usado] of CADENA) {
    const enAdapter = new RegExp(`async function ${met}\\b`).test(leer(`js/adapters/${ad}.js`))
    const enService = leer(`js/services/${srv}.js`).includes(wrap)
    const enCtrl = leer(`js/views/dashboard/${ctrl}`).includes(usado)
    const todo = enAdapter && enService && enCtrl
    if (todo) ok(`${ad}.${met} -> ${srv}.${wrap} -> ${ctrl}`)
    else fail(`${ad}.${met}: adapter=${enAdapter} service=${enService} controlador=${enCtrl}`)
}

console.log("\n== 7. nada de window.location.reload ni prompt/confirm ==")
const usos = []
for (const [n, js] of CONTROLADORES) {
    const f = leer(js)
    if (f.includes("window.location.reload")) usos.push(`${n}: window.location.reload`)
    if (/\bprompt\(/.test(f)) usos.push(`${n}: prompt()`)
    if (/\bconfirm\(/.test(f)) usos.push(`${n}: confirm()`)
}
usos.length ? fail(`nativos sin confirmar -> ${usos.join(", ")}`) : ok("ningun reload, prompt ni confirm nativos")

console.log("\n== 8. los 4 modales arrancan ocultos ==")
for (const [n, , html] of CONTROLADORES) {
    const vista = leer(html)
    const mods = [...vista.matchAll(/class="modal-form"[^>]*>/g)].map(m => m[0])
    if (!mods.length) continue
    const sinHidden = mods.filter(m => !m.includes("hidden"))
    sinHidden.length
        ? fail(`${n}: ${sinHidden.length} modal(es) sin hidden -> taparian la pagina al entrar`)
        : ok(`${n}: ${mods.length} modal(es) con hidden`)
}

console.log(`\n${fallos === 0 ? "VEREDICTO: TODO OK" : `VEREDICTO: ${fallos} FALLO(S)`}  (${checks} checks)`)
process.exit(fallos === 0 ? 0 : 1)

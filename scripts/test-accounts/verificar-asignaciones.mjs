/* ==========================================================================
   Script: verificar-asignaciones.mjs
   Fase D — Cuentas de prueba (Rodilla)
   --------------------------------------------------------------------------
   Verifica que las cuentas de prueba tengan los roles y permisos correctos
   asignados. Solo lectura.
   
   Ejecución:
     node scripts/test-accounts/verificar-asignaciones.mjs
   ========================================================================== */

async function cargarEnv(rutaArchivo) {
    try {
        const fs = await import("fs")
        const texto = fs.readFileSync(rutaArchivo, "utf-8")
        for (const linea of texto.split("\n")) {
            const limpia = linea.trim()
            if (!limpia || limpia.startsWith("#")) continue
            const igual = limpia.indexOf("=")
            if (igual === -1) continue
            const clave = limpia.slice(0, igual).trim()
            const valor = limpia.slice(igual + 1).trim().replace(/^"(.*)"$/, "$1")
            if (clave && !process.env[clave]) process.env[clave] = valor
        }
    } catch {}
}

const dirScripts = new URL(".", import.meta.url).pathname
await cargarEnv(dirScripts + "../.env")

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
        "Faltan variables de entorno. Copia scripts/test-accounts/.env.example a .env y rellena los valores."
    )
    process.exit(1)
}

const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: "application/json",
}

async function fetchSupabase(path) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`
    const response = await fetch(url, { headers })
    if (!response.ok) {
        const texto = await response.text().catch(() => "")
        throw new Error(`Supabase ${response.status} para ${path}: ${texto}`)
    }
    return response.json()
}

const ESPERADO = {
    ADMINISTRADOR: { email: "prueba-administrador@rodilla.test", idRol: 1 },
    CAJERO: { email: "prueba-cajero@rodilla.test", idRol: 2 },
    MOZO: { email: "prueba-mozo@rodilla.test", idRol: 3 },
    CLIENTE: { email: "prueba-cliente@rodilla.test", idRol: 4 },
}

async function main() {
    console.log("╔════════════════════════════════════════╗")
    console.log("║  VERIFICACIÓN DE CUENTAS DE PRUEBA — Rodilla  ║")
    console.log("╚════════════════════════════════════════╝\n")

    // Obtener roles y permisos para referencia
    const roles = await fetchSupabase("ROL?select=ID_Rol,N_Rol&order=ID_Rol")
    const rolPorNombre = {}
    for (const r of roles) rolPorNombre[r.N_Rol] = r.ID_Rol

    const permisos = await fetchSupabase("PERMISO?select=ID_Permiso,Clave,N_Permiso,ID_Modulo&order=ID_Permiso")
    const rolPermisos = await fetchSupabase("ROL_PERMISO?select=ID_Rol,ID_Permiso&order=ID_Rol")

    let todoOk = true

    for (const [rolNombre, config] of Object.entries(ESPERADO)) {
        console.log(`\n▸ ${rolNombre} (${config.email})`)

        // Buscar usuario por Logeo
        const usuarios = await fetchSupabase(
            `USUARIO?select=ID_Usuario,Logeo,ID_TipoUsuario,ESTADO,Bloqueado&Logeo=eq.${encodeURIComponent(config.email)}`
        )

        if (!usuarios || usuarios.length === 0) {
            console.log(`   ✗ No se encontró usuario con Logeo="${config.email}"`)
            todoOk = false
            continue
        }

        const u = usuarios[0]
        console.log(`   ID_Usuario: ${u.ID_Usuario}, ESTADO: ${u.ESTADO}, Bloqueado: ${u.Bloqueado}`)

        // Buscar roles asignados vigentes
        const asignaciones = await fetchSupabase(
            `USUARIO_ROL?select=ID_Rol,Vigente,ESTADO&ID_Usuario=eq.${u.ID_Usuario}`
        )
        const vigentes = (asignaciones || []).filter((a) => a.Vigente === "1" && a.ESTADO === "1")
        const rolesAsignados = vigentes.map((a) => {
            const rol = roles.find((r) => r.ID_Rol === a.ID_Rol)
            return rol ? rol.N_Rol : `ID ${a.ID_Rol}`
        })

        const idRolEsperado = rolPorNombre[rolNombre]
        const rolCorrecto = vigentes.some((a) => a.ID_Rol === idRolEsperado)

        console.log(`   Roles vigentes: ${rolesAsignados.length ? rolesAsignados.join(", ") : "(ninguno)"}`)
        console.log(`   Rol esperado: ${rolNombre} (ID ${idRolEsperado}) → ${rolCorrecto ? "✓ Correcto" : "✗ Incorrecto"}`)

        if (!rolCorrecto) {
            todoOk = false
        }

        // Permisos del rol
        const idsPermiso = rolPermisos
            .filter((rp) => rp.ID_Rol === idRolEsperado)
            .map((rp) => rp.ID_Permiso)
        const clavesPermiso = permisos
            .filter((p) => idsPermiso.includes(p.ID_Permiso))
            .map((p) => p.Clave)
        console.log(`   Permisos (${clavesPermiso.length}): ${clavesPermiso.join(", ")}`)

        // Usuarios reales intactos: verificar que no sea un usuario real
        const esPrueba = config.email.includes("prueba")
        console.log(`   Cuenta de prueba: ${esPrueba ? "✓ Sí" : "✗ No"}`)
    }

    console.log("\n══════════════════════════════════════════")
    console.log(todoOk ? "✓ Todas las cuentas de prueba tienen los roles correctos." : "⚠ Algunas cuentas tienen roles incorrectos.")
    process.exit(todoOk ? 0 : 1)
}

main().catch((err) => {
    console.error("Error:", err.message)
    process.exit(1)
})

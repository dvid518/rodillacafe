/* ==========================================================================
   Script: consultar-roles.mjs
   Fase D — Cuentas de prueba (Rodilla)
   --------------------------------------------------------------------------
   Consulta roles, permisos y usuarios existentes en Supabase usando la
   Service Role Key (Admin API).
   Solo lectura. No modifica datos.

   Requisitos:
   - SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY definidas en el entorno
     (copiar scripts/test-accounts/.env.example a .env y rellenar, o exportar)

   Ejecución:
     node scripts/test-accounts/consultar-roles.mjs
   ========================================================================== */

/* Carga simple de variables desde .env si existe, sin dependencias de npm. */
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
            if (clave && !process.env[clave]) {
                process.env[clave] = valor
            }
        }
    } catch {
        // .env no existe: se usan variables del entorno directamente
    }
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
    "Content-Type": "application/json",
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

async function main() {
    console.log("╔════════════════════════════════════════╗")
    console.log("║  CONSULTA DE ROLES Y PERMISOS — Rodilla  ║")
    console.log("╚════════════════════════════════════════╝\n")

    // 1. Roles
    console.log("▸ Roles en la tabla ROL:")
    const roles = await fetchSupabase("ROL?select=*&order=ID_Rol")
    for (const rol of roles) {
        console.log(`   ${rol.ID_Rol}. ${rol.N_Rol} (nivel ${rol.Nivel}) — ${rol.Descripcion || "-"}`)
    }

    // 2. Permisos
    console.log("\n▸ Permisos en la tabla PERMISO:")
    const permisos = await fetchSupabase("PERMISO?select=*&order=ID_Modulo,ID_Permiso")
    const permisosPorModulo = {}
    for (const p of permisos) {
        if (!permisosPorModulo[p.ID_Modulo]) permisosPorModulo[p.ID_Modulo] = []
        permisosPorModulo[p.ID_Modulo].push(p)
    }
    for (const [idModulo, lista] of Object.entries(permisosPorModulo)) {
        const modulo = lista[0]
        console.log(`   Módulo ${idModulo}:`)
        for (const p of lista) {
            console.log(`     • ${p.Clave} — ${p.N_Permiso}`)
        }
    }

    // 3. Asignaciones ROL_PERMISO
    console.log("\n▸ Matriz ROL → PERMISO (ROL_PERMISO):")
    const rolPermisos = await fetchSupabase(
        "ROL_PERMISO?select=ID_Rol,ID_Permiso&order=ID_Rol,ID_Permiso"
    )
    const matriz = {}
    for (const rp of rolPermisos) {
        if (!matriz[rp.ID_Rol]) matriz[rp.ID_Rol] = []
        matriz[rp.ID_Rol].push(rp.ID_Permiso)
    }
    for (const rol of roles) {
        const idsPermiso = matriz[rol.ID_Rol] || []
        const claves = permisos
            .filter((p) => idsPermiso.includes(p.ID_Permiso))
            .map((p) => p.Clave)
        console.log(`   ${rol.N_Rol}: ${claves.length ? claves.join(", ") : "(ninguno)"}`)
    }

    // 4. Usuarios con roles
    console.log("\n▸ Usuarios existentes (USUARIO + USUARIO_ROL):")
    const usuarios = await fetchSupabase(
        "USUARIO?select=ID_Usuario,Logeo,ID_TipoUsuario,ESTADO,Bloqueado,USUARIO_ROL(ID_Rol,ROL(N_Rol))&order=ID_Usuario"
    )
    for (const u of usuarios) {
        const rolesUsuario = (u.USUARIO_ROL || [])
            .filter((ur) => ur.Vigente === "1" && ur.ESTADO === "1")
            .map((ur) => ur.ROL?.N_Rol || "?")
            .join(", ") || "(sin rol)"
        const esPrueba = u.Logeo.includes("prueba") || u.Logeo.includes("@rodilla.test")
        console.log(`   ID ${u.ID_Usuario}: ${u.Logeo} [${rolesUsuario}]${esPrueba ? "  ← prueba" : ""}`)
    }

    // 5. Cuentas de prueba existentes
    console.log("\n▸ Cuentas de prueba identificadas (patrón prueba-* o *@rodilla.test):")
    const cuentasPrueba = usuarios.filter(
        (u) => u.Logeo.includes("prueba") || u.Logeo.includes("@rodilla.test")
    )
    if (cuentasPrueba.length === 0) {
        console.log("   (ninguna)")
    } else {
        for (const u of cuentasPrueba) {
            console.log(`   • ${u.Logeo} (ID ${u.ID_Usuario})`)
        }
    }

    console.log("\n✓ Consulta completada.")
}

main().catch((err) => {
    console.error("Error:", err.message)
    process.exit(1)
})

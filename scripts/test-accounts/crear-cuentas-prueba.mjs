/* ==========================================================================
   Script: crear-cuentas-prueba.mjs
   Fase D — Cuentas de prueba (Rodilla)
   --------------------------------------------------------------------------
   Crea una cuenta de prueba independiente por cada rol existente
   (ADMINISTRADOR, CAJERO, MOZO, CLIENTE) en Supabase Auth usando la
   Service Role Key (Admin API).
   
   Reglas de seguridad:
   - Idempotente: ejecutar varias veces no duplica cuentas ni roles.
   - No modifica, sobrescribe ni elimina usuarios reales.
   - Si hay colisión de correo, detiene esa cuenta y continúa con las demás.
   - SUPABASE_SERVICE_ROLE_KEY solo por variable de entorno.

   Ejecución:
     node scripts/test-accounts/crear-cuentas-prueba.mjs
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
    "Content-Type": "application/json",
    Accept: "application/json",
}

async function fetchSupabase(path, opciones = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`
    const response = await fetch(url, { headers, ...opciones })
    if (!response.ok) {
        const texto = await response.text().catch(() => "")
        throw new Error(`Supabase ${response.status} para ${path}: ${texto}`)
    }
    if (response.status === 204) return null
    return response.json()
}

async function fetchAuthAdmin(path, opciones = {}) {
    const url = `${SUPABASE_URL}/auth/v1/admin/${path}`
    const response = await fetch(url, { headers, ...opciones })
    if (!response.ok) {
        const texto = await response.text().catch(() => "")
        throw new Error(`Supabase Auth ${response.status} para ${path}: ${texto}`)
    }
    if (response.status === 204) return null
    return response.json()
}

// Rol → configuración de cuenta de prueba
const CUENTAS_POR_ROL = [
    {
        rol: "ADMINISTRADOR",
        email: "prueba-administrador@rodilla.test",
        password: "RodillaPruebaAdmin2026!",
        idTipoUsuario: 1, // ADMINISTRADOR
        idRol: 1, // ADMINISTRADOR
    },
    {
        rol: "CAJERO",
        email: "prueba-cajero@rodilla.test",
        password: "RodillaPruebaCajero2026!",
        idTipoUsuario: 2, // OPERATIVO
        idRol: 2, // CAJERO
    },
    {
        rol: "MOZO",
        email: "prueba-mozo@rodilla.test",
        password: "RodillaPruebaMozo2026!",
        idTipoUsuario: 2, // OPERATIVO
        idRol: 3, // MOZO
    },
    {
        rol: "CLIENTE",
        email: "prueba-cliente@rodilla.test",
        password: "RodillaPruebaCliente2026!",
        idTipoUsuario: 3, // CLIENTE
        idRol: 4, // CLIENTE
    },
]

async function usuarioExistePorLogeo(logeo) {
    const usuarios = await fetchSupabase(
        `USUARIO?select=ID_Usuario,Logeo&Logeo=eq.${encodeURIComponent(logeo)}`
    )
    return usuarios && usuarios.length > 0 ? usuarios[0] : null
}

async function crearCuenta(authConfig) {
    const { rol, email, password, idTipoUsuario, idRol } = authConfig

    console.log(`\n▸ Procesando rol: ${rol} (${email})`)

    // 1. Idempotencia: ¿ya existe un USUARIO con este Logeo?
    const existente = await usuarioExistePorLogeo(email)
    if (existente) {
        console.log(`   Ya existe USUARIO con Logeo="${email}" (ID ${existente.ID_Usuario}). Se omite la creación.`)
        return { rol, email, idUsuario: existente.ID_Usuario, creado: false, omitido: true }
    }

    // 2. Crear en Supabase Auth (Admin API). El trigger fn_handle_new_user
    //    crea PERSONA + CLIENTE + USUARIO + rol CLIENTE automáticamente.
    console.log("   Creando cuenta en Supabase Auth…")
    const creado = await fetchAuthAdmin("users", {
        method: "POST",
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                proveedor: "prueba",
                rol_asignado: rol,
            },
        }),
    })
    const authId = creado.id
    console.log(`   Usuario de Auth creado: ${authId}`)

    // 3. Esperar a que el trigger fn_handle_new_user cree el USUARIO vinculado.
    //    Polling con timeout máximo de 10 segundos en lugar de espera fija.
    const timeoutMs = 10000
    const intervaloMs = 500
    let transcurrido = 0
    let usuario = null

    while (transcurrido < timeoutMs && !usuario) {
        const usuarios = await fetchSupabase(
            `USUARIO?select=ID_Usuario,Logeo,ID_TipoUsuario&auth_id=eq.${authId}`
        )
        if (usuarios && usuarios.length > 0) {
            usuario = usuarios[0]
            break
        }
        await new Promise((resolve) => setTimeout(resolve, intervaloMs))
        transcurrido += intervaloMs
    }

    if (!usuario) {
        throw new Error(`No se encontró el USUARIO vinculado a auth_id ${authId} tras ${timeoutMs / 1000} segundos`)
    }
    console.log(`   USUARIO encontrado: ID ${usuario.ID_Usuario}`)

    // 5. Obtener el ID_Rol real desde la tabla ROL (por nombre, no asumir ID).
    const rolesTabla = await fetchSupabase(`ROL?select=ID_Rol,N_Rol&N_Rol=eq.${encodeURIComponent(rol)}`)
    if (!rolesTabla || rolesTabla.length === 0) {
        throw new Error(`El rol "${rol}" no existe en la tabla ROL`)
    }
    const idRolReal = rolesTabla[0].ID_Rol

    // 6. Desactivar roles existentes para este usuario y asignar el correcto.
    await fetchSupabase(
        `USUARIO_ROL?ID_Usuario=eq.${usuario.ID_Usuario}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                Vigente: "0",
                ESTADO: "0",
                USUMOD: "PRUEBA_SCRIPT",
                FECMOD: new Date().toISOString(),
            }),
        }
    )

    // Insertar o actualizar el rol deseado
    const rolExistente = await fetchSupabase(
        `USUARIO_ROL?select=*&ID_Usuario=eq.${usuario.ID_Usuario}&ID_Rol=eq.${idRolReal}`
    )
    if (rolExistente && rolExistente.length > 0) {
        await fetchSupabase(
            `USUARIO_ROL?ID_Usuario=eq.${usuario.ID_Usuario}&ID_Rol=eq.${idRolReal}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    Vigente: "1",
                    ESTADO: "1",
                    USUMOD: "PRUEBA_SCRIPT",
                    FECMOD: new Date().toISOString(),
                }),
            }
        )
    } else {
        await fetchSupabase("USUARIO_ROL", {
            method: "POST",
            body: JSON.stringify({
                ID_Usuario: usuario.ID_Usuario,
                ID_Rol: idRolReal,
                Vigente: "1",
                ESTADO: "1",
                USUCRE: "PRUEBA_SCRIPT",
            }),
        })
    }

    // 7. Actualizar ID_TipoUsuario en USUARIO
    await fetchSupabase(
        `USUARIO?ID_Usuario=eq.${usuario.ID_Usuario}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                ID_TipoUsuario: idTipoUsuario,
                USUMOD: "PRUEBA_SCRIPT",
                FECMOD: new Date().toISOString(),
            }),
        }
    )

    console.log(`   Rol "${rol}" asignado (ID_Rol=${idRolReal}, ID_TipoUsuario=${idTipoUsuario}).`)
    return { rol, email, idUsuario: usuario.ID_Usuario, creado: true, omitido: false }
}

async function main() {
    console.log("╔════════════════════════════════════════╗")
    console.log("║  CREACIÓN DE CUENTAS DE PRUEBA — Rodilla  ║")
    console.log("╚════════════════════════════════════════╝\n")

    const resultados = []
    let errores = 0

    for (const config of CUENTAS_POR_ROL) {
        try {
            const resultado = await crearCuenta(config)
            resultados.push(resultado)
        } catch (err) {
            errores++
            console.error(`   ✗ Error creando cuenta para ${config.rol}: ${err.message}`)
            resultados.push({ rol: config.rol, email: config.email, creado: false, error: err.message })
        }
    }

    console.log("\n══════════════════════════════════════════")
    console.log("RESUMEN:")
    for (const r of resultados) {
        const estado = r.omitido ? "omitido (ya existía)" : r.creado ? "creado" : "ERROR"
        console.log(`   ${r.rol}: ${estado}`)
    }
    if (errores > 0) {
        console.log(`\n⚠ ${errores} cuenta(s) no se pudieron crear. Revisar errores arriba.`)
        process.exit(1)
    }
    console.log("\n✓ Todas las cuentas de prueba fueron procesadas.")
    console.log("\nNOTA: Las contraseñas no se muestran en este informe.")
}

main().catch((err) => {
    console.error("Error fatal:", err.message)
    process.exit(1)
})

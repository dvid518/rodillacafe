import { supabase } from "../lib/supabaseClient.js"

const ROLES = ["ADMINISTRADOR", "CAJERO", "MOZO", "CLIENTE"]

async function getRoles() {
    const roles = []
    for (const rol of ROLES) {
        const { data, error } = await supabase.rpc("is_rol", { p_rol: rol })
        if (error) return { ok: false, error }
        if (data) roles.push(rol)
    }
    return { ok: true, data: roles }
}

async function getPerfilByAuthId(authId) {
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Usuario, ID_Cliente, Logeo, Bloqueado, ESTADO")
        .eq("auth_id", authId)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }
    if (!usuario) return { ok: false, error: { message: "No existe un usuario vinculado a esta cuenta" } }
    if (usuario.Bloqueado === "1") return { ok: false, error: { message: "El usuario está bloqueado" } }

    if (!usuario.ID_Cliente) return { ok: true, data: { ...usuario, nombre: "", email: usuario.Logeo, celular: "" } }

    const { data: cliente, error: errCliente } = await supabase
        .from("CLIENTE")
        .select("ID_Cliente, ID_Persona, Puntos, Tipo_Cliente")
        .eq("ID_Cliente", usuario.ID_Cliente)
        .maybeSingle()
    if (errCliente) return { ok: false, error: errCliente }

    let persona = null
    if (cliente && cliente.ID_Persona) {
        const { data: p, error: errPersona } = await supabase
            .from("PERSONA")
            .select("ID_Persona, Nombre, Ap_Paterno, EMAIL, Celular")
            .eq("ID_Persona", cliente.ID_Persona)
            .maybeSingle()
        if (errPersona) return { ok: false, error: errPersona }
        persona = p
    }

    return {
        ok: true,
        data: {
            ...usuario,
            ID_Persona: persona ? persona.ID_Persona : null,
            nombre: persona ? [persona.Nombre, persona.Ap_Paterno || ""].filter(Boolean).join(" ").trim() : "",
            email: persona && persona.EMAIL ? persona.EMAIL : usuario.Logeo,
            celular: persona ? persona.Celular : ""
        }
    }
}

async function listarUsuarios() {
    const { data, error } = await supabase
        .from("USUARIO")
        .select(`
            ID_Usuario,
            ID_TipoUsuario,
            Logeo,
            Bloqueado,
            ESTADO,
            CLIENTE ( ID_Cliente, PERSONA ( Nombre, Ap_Paterno, EMAIL, Celular ) ),
            EMPLEADO ( ID_Empleado, PERSONA ( Nombre, Ap_Paterno, EMAIL, Celular ) ),
            USUARIO_ROL ( ID_Rol, ROL ( N_Rol ) )
        `)
        .order("ID_Usuario")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

/**
 * Promueve un usuario a ADMINISTRADOR.
 *
 * NO usa supabase.rpc("usp_PromoverAdmin") porque ese procedimiento SQL puede
 * no estar desplegado en la base de datos (da 404 de red que el navegador
 * muestra como "Failed to load resource"). En su lugar hace las mismas
 * operaciones directamente vía Supabase client:
 *
 * 1. Busca el usuario por Logeo en USUARIO
 * 2. Resuelve el ID_Rol del rol ADMINISTRADOR en ROL
 * 3. Actualiza USUARIO.ID_TipoUsuario = 1
 * 4. Upsert en USUARIO_ROL activando el rol ADMINISTRADOR
 * 5. Revoca los demás roles (Vigente = '0', ESTADO = '0')
 *
 * Así nunca hay un HTTP 404 del RPC ni el usuario lo ve.
 */
async function promoverAdmin(email) {
    return promoverAdminDirecto(email)
}

/**
 * Detecta si un error de Supabase corresponde a "función/procedimiento no
 * encontrado" (código SQL 42883, HTTP 404, o mensaje descriptivo).
 */
function esErrorFuncNoEncontrada(error) {
    if (!error) return false
    const codigo = String(error.code || "")
    const status = String(error.status || "")
    const mensaje = String(error.message || "")
    return (
        codigo === "42883" ||
        status === "404" ||
        /function.*not found/i.test(mensaje) ||
        /procedure.*not found/i.test(mensaje) ||
        /usp_promoveradmin/i.test(mensaje)
    )
}

/**
 * Promocion directa sin depender del RPC usp_PromoverAdmin.
 * Hace lo mismo que el procedimiento: fija ID_TipoUsuario = 1,
 * activa el rol ADMINISTRADOR y revoca los demas.
 */
async function promoverAdminDirecto(email) {
    // 1) Localizar el usuario por Logeo
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .select("ID_Usuario, ID_TipoUsuario, Logeo")
        .eq("Logeo", email)
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }
    if (!usuario) {
        return { ok: false, error: { message: "Usuario no encontrado: " + email } }
    }

    // 2) Resolver ID_Rol de ADMINISTRADOR
    const { data: rol, error: errRol } = await supabase
        .from("ROL")
        .select("ID_Rol")
        .eq("N_Rol", "ADMINISTRADOR")
        .eq("ESTADO", "1")
        .maybeSingle()
    if (errRol) return { ok: false, error: errRol }
    if (!rol) {
        return { ok: false, error: { message: "Rol ADMINISTRADOR no existe en la base de datos" } }
    }

    const ahora = new Date().toISOString()

    // 3) Actualizar USUARIO: ID_TipoUsuario = 1 (ADMINISTRADOR)
    const { error: errUpdate } = await supabase
        .from("USUARIO")
        .update({
            ID_TipoUsuario: 1,
            USUMOD: "ADMIN",
            FECMOD: ahora,
        })
        .eq("ID_Usuario", usuario.ID_Usuario)
    if (errUpdate) return { ok: false, error: errUpdate }

    // 4) Upsert USUARIO_ROL: activar rol ADMINISTRADOR
    const { error: errUpsert } = await supabase
        .from("USUARIO_ROL")
        .upsert(
            {
                ID_Usuario: usuario.ID_Usuario,
                ID_Rol: rol.ID_Rol,
                Vigente: "1",
                ESTADO: "1",
                USUCRE: "ADMIN",
                FECMOD: ahora,
            },
            { onConflict: ["ID_Usuario", "ID_Rol"] }
        )
    if (errUpsert) return { ok: false, error: errUpsert }

    // 5) Revocar cualquier otro rol vigente
    const { error: errRevoke } = await supabase
        .from("USUARIO_ROL")
        .update({
            Vigente: "0",
            ESTADO: "0",
            USUMOD: "ADMIN",
            FECMOD: ahora,
        })
        .eq("ID_Usuario", usuario.ID_Usuario)
        .neq("ID_Rol", rol.ID_Rol)
    if (errRevoke) return { ok: false, error: errRevoke }

    return { ok: true, data: { ID_Usuario: usuario.ID_Usuario } }
}

/**
 * Busca una PERSONA por número de documento (DNI). Devuelve los datos de la
 * persona junto con su ID_TipoIdentidad, o null si no existe.
 */
async function buscarPersonaPorDNI(nDocumento) {
    const doc = String(nDocumento).trim()
    if (!doc) return { ok: false, error: { message: "DNI vacío" } }

    // Localizar tipo de documento DNI (misma lógica que el trigger de auth)
    let { data: tipos } = await supabase
        .from("TIPO_IDENTIDAD")
        .select("ID_TipoIdentidad")
        .eq("Abreviatura", "DNI")
        .maybeSingle()
    let idTipoDoc = tipos?.ID_TipoIdentidad
    if (!idTipoDoc) {
        const { data: t2 } = await supabase
            .from("TIPO_IDENTIDAD")
            .select("ID_TipoIdentidad")
            .limit(1)
            .maybeSingle()
        idTipoDoc = t2?.ID_TipoIdentidad
    }
    if (!idTipoDoc) {
        return { ok: false, error: { message: "No hay tipo de documento DNI configurado" } }
    }

    const { data, error } = await supabase
        .from("PERSONA")
        .select("ID_Persona, ID_TipoIdentidad, ID_Distrito, N_Documento, Nombre, Ap_Paterno, Ap_Materno, F_Nacimiento, EMAIL, Celular, Genero, Direccion, ESTADO")
        .eq("ID_TipoIdentidad", idTipoDoc)
        .eq("N_Documento", doc)
        .eq("ESTADO", "1")
        .maybeSingle()
    if (error) return { ok: false, error }
    return { ok: true, data: data || null, idTipoDoc }
}

/**
 * Busca si ya existe un USUARIO vinculado a una persona con ese DNI.
 * Devuelve el usuario completo (con CLIENTE.PERSONA) o null.
 * El filtro por DNI se hace en memoria porque la FK va por ID_Cliente, no por documento.
 */
async function buscarUsuarioPorDNI(nDocumento) {
    const { data: persona, idTipoDoc } = await buscarPersonaPorDNI(nDocumento)
    if (!persona) return { ok: true, data: null }

    const { data: todos, error } = await supabase
        .from("USUARIO")
        .select(`
            ID_Usuario, ID_TipoUsuario, ID_Cliente, auth_id, Logeo, Bloqueado, ESTADO,
            CLIENTE ( ID_Cliente, ID_Persona, PERSONA ( ID_Persona, N_Documento, Nombre, Ap_Paterno, Ap_Materno, EMAIL, Celular ) )
        `)
    if (error) return { ok: false, error }

    const encontrado = (todos || []).find(u => {
        const p = u.CLIENTE?.[0]?.PERSONA?.[0]
        return p && String(p.N_Documento).trim() === String(nDocumento).trim()
    })

    return { ok: true, data: encontrado || null }
}

/**
 * Crea de alta manual una PERSONA + CLIENTE + USUARIO + USUARIO_ROL(CLIENTE).
 * Se usa cuando el DNI no está en la BD y los datos vienen de una consulta externa.
 */
async function crearUsuarioManual(datos) {
    const {
        nDocumento,
        nombre,
        apPaterno,
        apMaterno,
        email,
        celular,
        logeo,
        usucre = "WEB",
    } = datos

    if (!nDocumento) return { ok: false, error: { message: "El DNI es obligatorio" } }

    // 1) Tipo de documento DNI y verificar que no exista ya
    const rBusqueda = await buscarPersonaPorDNI(nDocumento)
    if (!rBusqueda.ok) return { ok: false, error: rBusqueda.error }
    const { data: personaExistente, idTipoDoc } = rBusqueda
    if (personaExistente) {
        return { ok: false, error: { message: "Ya existe una persona con ese DNI", existe: true } }
    }
    if (!idTipoDoc) {
        return { ok: false, error: { message: "No hay tipo de documento DNI configurado" } }
    }

    // 2) Tipo de usuario CLIENTE (id 3, como usa el trigger de auth)
    const { data: tipoUsuario } = await supabase
        .from("TIPO_USUARIO")
        .select("ID_TipoUsuario")
        .eq("ESTADO", "1")
        .limit(1)
        .maybeSingle()
    const idTipoUsuario = tipoUsuario?.ID_TipoUsuario
    if (!idTipoUsuario) {
        return { ok: false, error: { message: "No hay tipo de usuario configurado" } }
    }

    // 3) Insertar PERSONA
    const { data: persona, error: errPersona } = await supabase
        .from("PERSONA")
        .insert({
            ID_TipoIdentidad: idTipoDoc,
            N_Documento: String(nDocumento).trim(),
            Nombre: String(nombre || "").trim() || null,
            Ap_Paterno: String(apPaterno || "").trim() || null,
            Ap_Materno: String(apMaterno || "").trim() || null,
            EMAIL: String(email || "").trim() || null,
            Celular: String(celular || "").trim() || null,
            USUCRE: String(usucre).substring(0, 30),
            ESTADO: "1",
        })
        .select()
        .maybeSingle()
    if (errPersona) return { ok: false, error: errPersona }

    // 4) Insertar CLIENTE (Tipo_Cliente = 'N' persona natural)
    const { data: cliente, error: errCliente } = await supabase
        .from("CLIENTE")
        .insert({
            ID_Persona: persona.ID_Persona,
            Tipo_Cliente: "N",
            USUCRE: String(usucre).substring(0, 30),
            ESTADO: "1",
        })
        .select()
        .maybeSingle()
    if (errCliente) return { ok: false, error: errCliente }

    // 5) Insertar USUARIO (sin auth_id: alta manual, no viene de auth.users)
    const logeoFinal = logeo || String(nDocumento).trim()
    const { data: usuario, error: errUsuario } = await supabase
        .from("USUARIO")
        .insert({
            ID_TipoUsuario: idTipoUsuario,
            ID_Cliente: cliente.ID_Cliente,
            auth_id: null,
            Logeo: String(logeoFinal).substring(0, 120),
            USUCRE: String(usucre).substring(0, 30),
            ESTADO: "1",
        })
        .select()
        .maybeSingle()
    if (errUsuario) return { ok: false, error: errUsuario }

    // 6) Asignar rol CLIENTE (id 4, como usa el trigger de auth)
    const { data: rol } = await supabase
        .from("ROL")
        .select("ID_Rol")
        .eq("N_Rol", "CLIENTE")
        .eq("ESTADO", "1")
        .limit(1)
        .maybeSingle()
    if (rol?.ID_Rol) {
        await supabase
            .from("USUARIO_ROL")
            .insert({
                ID_Usuario: usuario.ID_Usuario,
                ID_Rol: rol.ID_Rol,
                USUCRE: String(usucre).substring(0, 30),
                ESTADO: "1",
            })
    }

    return {
        ok: true,
        data: { ...usuario, persona, cliente },
    }
}

async function listarClientes() {
    const { data, error } = await supabase
        .from("CLIENTE")
        .select(`
            ID_Cliente,
            Tipo_Cliente,
            PERSONA ( Nombre, Ap_Paterno, EMAIL )
        `)
        .order("ID_Cliente")
    if (error) return { ok: false, error }
    return { ok: true, data }
}

export const UserAdapter = {
    getRoles,
    getPerfilByAuthId,
    listarUsuarios,
    listarClientes,
    promoverAdmin,
    buscarPersonaPorDNI,
    buscarUsuarioPorDNI,
    crearUsuarioManual,
}
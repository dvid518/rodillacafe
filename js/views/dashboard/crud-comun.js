import { Modal } from "../../components/Modal.js"
import { escaparHTML, formatearPrecio } from "../../utils/format.js"

/* ==========================================================================
   COMÚN A LOS CRUD DEL PANEL
   --------------------------------------------------------------------------
   pedidos, reservas, mensajes y usuarios repiten el mismo andamiaje: abrir y
   cerrar un modal, pintar una etiqueta de estado, avisar cuando una tabla
   está vacía, confirmar un borrado y llenar el <select> de clientes. Está
   aquí en vez de copiado cinco veces para que un cambio en el comportamiento
   del modal no deje tres vistas desincronizadas.

   Los modales se ocultan con el atributo `hidden`, no con una clase: es lo
   que ya hacen carta.js y categorias.js, y evita el estado intermedio en el
   que un modal tiene las dos cosas a la vez.
   ========================================================================== */

/* ---------- modal de formulario ---------- */

let scrollBloqueado = false

export function abrirModal(modal, primerCampo = null) {
    if (!modal) return
    modal.hidden = false
    if (!scrollBloqueado) {
        document.body.classList.add("sin-scroll")
        scrollBloqueado = true
    }
    if (primerCampo) {
        // el foco necesita un turno: si no, el navegador lo ignora porque el
        // elemento acaba de dejar de estar oculto
        requestAnimationFrame(() => primerCampo.focus())
    }
}

export function cerrarModal(modal) {
    if (!modal) return
    modal.hidden = true
    document.body.classList.remove("sin-scroll")
    scrollBloqueado = false
}

/** Cierra con Escape el modal que esté abierto. Devuelve el cleanup. */
export function cerrarConEscape(...modales) {
    const onKey = e => {
        if (e.key !== "Escape") return
        for (const m of modales) {
            if (m && !m.hidden) return cerrarModal(m)
        }
    }
    document.addEventListener("keydown", onKey)
    return () => {
        document.removeEventListener("keydown", onKey)
        document.body.classList.remove("sin-scroll")
    }
}

/* ---------- dinero ---------- */

/**
 * formatearPrecio() devuelve solo el numero ("46.00"), sin moneda. Las
 * columnas de dinero del panel llevan la suya, asi que se pasa por aqui para
 * que "S/" no se pierda al pintar (o se duplique, segun quien llame).
 */
export function monto(valor) {
    return `S/ ${formatearPrecio(valor)}`
}

/* ---------- tablas ---------- */

export const ETIQUETA_VACIA = "Sin registros"

/**
 * Fila de "no hay nada". Se pone un texto de verdad en vez de colspan con
 * estilos en linea: si la consulta falló y la lista viene vacia, el usuario
 * no puede distinguirlo de una tabla que si esta vacia.
 */
export function filaVacia(celdas, texto = ETIQUETA_VACIA) {
    return `<tr class="fila-vacia"><td colspan="${celdas}">${escaparHTML(texto)}</td></tr>`
}

/** Fila de error, para cuando el listado no se pudo leer. */
export function filaError(celdas, que) {
    return `<tr class="fila-vacia fila-vacia--error"><td colspan="${celdas}">No se pudo leer ${escaparHTML(que)}</td></tr>`
}

/**
 * Etiqueta de estado. El mapa trae la letra y el texto; una letra que no esté
 * en el mapa se muestra tal cual, para no perder el dato raro.
 */
export function badge(mapa, situacion) {
    const letra = situacion ?? "-"
    const texto = mapa[letra]
    if (!texto) return `<span class="chip chip--neutro">${escaparHTML(String(letra))}</span>`
    return `<span class="chip chip--estado-${escaparHTML(String(letra).toLowerCase())}">${escaparHTML(texto)}</span>`
}

export const ESTADO_PEDIDO = { P: "Pendiente", A: "Aprobado", F: "Completado", X: "Anulado" }
export const ESTADO_RESERVA = { P: "Pendiente", A: "Aprobado", C: "Completada", X: "Cancelada" }
export const ESTADO_MENSAJE = { P: "Pendiente", L: "Leído", R: "Respondido" }

/** Opciones de <select> a partir del mapa de estados. */
export function opcionesEstado(mapa, seleccionado) {
    return Object.entries(mapa)
        .map(([letra, texto]) =>
            `<option value="${escaparHTML(letra)}"${letra === seleccionado ? " selected" : ""}>${escaparHTML(texto)}</option>`
        )
        .join("")
}

/* ---------- clientes ---------- */

export function nombreCliente(cliente) {
    const p = cliente?.PERSONA?.[0]
    if (!p) return `Cliente ${cliente?.ID_Cliente ?? "?"}`
    const nombre = [p.Nombre, p.Ap_Paterno].filter(Boolean).join(" ").trim()
    return nombre || `Cliente ${cliente.ID_Cliente}`
}

/**
 * Llena un <select> con los clientes. RLS solo deja leer CLIENTE al admin, asi
 * que para un cajero esto devuelve una lista vacia sin error: quien llama
 * tiene que decidir si eso significa "no hay clientes" (no es el caso) o
 * "no tienes permiso" (si), y en el segundo caso esconder el formulario.
 */
export function poblarClientes(select, clientes, { placeholder = "Seleccionar cliente" } = {}) {
    const lista = Array.isArray(clientes) ? clientes : []
    const vacio = document.createElement("option")
    vacio.value = ""
    vacio.textContent = placeholder
    vacio.disabled = true
    vacio.selected = true
    select.replaceChildren(vacio)

    for (const c of lista) {
        const opt = document.createElement("option")
        opt.value = c.ID_Cliente
        opt.textContent = nombreCliente(c)
        select.appendChild(opt)
    }
    return lista.length
}

/* ---------- usuarios ---------- */

/**
 * RLS de USUARIO: auth_id = auth.uid() or is_admin(). Un cajero recibe []
 * sin error, asi que el mapa queda vacio y quien lo use cae al ID numerico.
 */
export function mapaUsuarios(usuarios) {
    const lista = Array.isArray(usuarios) ? usuarios : []
    return new Map(lista.map(u => {
        const persona = u.CLIENTE?.[0]?.PERSONA?.[0]
        const nombre = persona?.Nombre
            ? [persona.Nombre, persona.Ap_Paterno].filter(Boolean).join(" ").trim()
            : null
        return [u.ID_Usuario, nombre || u.Logeo || `Usuario ${u.ID_Usuario}`]
    }))
}

export function rolesDe(usuario) {
    const roles = usuario?.USUARIO_ROL || []
    if (!roles.length) return "—"
    return roles
        .map(r => r.ROL?.[0]?.N_Rol)
        .filter(Boolean)
        .join(", ") || "—"
}

/* ---------- confirmacion de borrado ---------- */

/**
 * Reusa el componente Modal para confirmar. Se prefiere a window.confirm
 * porque el confirm nativo no se puede estilar y el proyecto ya tiene uno.
 */
export function confirmarBorrado({ titulo, cuerpo, onConfirm, textoBoton = "Eliminar" }) {
    const modal = new Modal({
        title: titulo,
        body: cuerpo,
        actions: [
            { label: "Cancelar", className: "btn btn--ghost" },
            {
                label: textoBoton,
                className: "btn btn--danger",
                onClick: async (m, boton) => {
                    boton.disabled = true
                    try {
                        await onConfirm()
                    } finally {
                        boton.disabled = false
                        m.close()
                    }
                },
            },
        ],
    })
    modal.open()
    return modal
}

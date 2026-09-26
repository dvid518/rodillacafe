import { icon } from "./Icon.js"

/* ==========================================================================
   NOTIFICACIONES
   --------------------------------------------------------------------------
   Avisos apilados. Dos decisiones gobiernan el resto:

   1. GLASS. El aviso es una lamina de vidrio tintada por tipo, no un
      rectangulo opaco. Se apoya en la clase .glass y la re-tinta con
      --toast, que cada variante define. El selector es .notification.glass
      (0,2,0) para ganarle a .glass (0,1,0) sin depender del orden de carga.

   2. LA PAGINA SIGUE VIVA DEBAJO. El contenedor .notifications es
      pointer-events: none, asi que los clics y el scroll atraviesan la zona
      donde hay avisos. Solo cada aviso captura eventos. Sin esto, un toast
      de 4s encima de "Iniciar Sesion" te lo roba durante 4 segundos.

   Compatibilidad: notificar(mensaje, tipo, duracion) mantiene la firma que
   usan notify.js y los ocho controladores de panel. La activacion sigue
   siendo la clase .visible.
   ========================================================================== */

const TIPOS = {
    success: { icono: "circle-check", rol: "status", vivo: "polite" },
    error: { icono: "circle-alert", rol: "alert", vivo: "assertive" },
    warning: { icono: "triangle-alert", rol: "alert", vivo: "assertive" },
    info: { icono: "info", rol: "status", vivo: "polite" },
}

const ID_CONTENEDOR = "notifications"
const MAX_VISIBLES = 4

/** Instancias vivas, para poder acotar la pila sin rascar el DOM. */
const vivas = new Set()

/** Crea (o recupera) el contenedor apilado. Nunca captura eventos. */
function contenedor() {
    let caja = document.getElementById(ID_CONTENEDOR)
    if (!caja) {
        caja = document.createElement("div")
        caja.id = ID_CONTENEDOR
        caja.className = "notifications"
        document.body.appendChild(caja)
    }
    return caja
}

class Notification {
    constructor({
        mensaje = "",
        titulo = "",
        tipo = "info",
        duracion = 4000,
        accion = null,
        permanente = false,
        alCerrar = null,
    } = {}) {
        this.tipo = TIPOS[tipo] ? tipo : "info"
        this.def = TIPOS[this.tipo]
        this.mensaje = mensaje
        this.titulo = titulo
        this.duracion = permanente ? 0 : duracion
        this.accion = accion
        this.alCerrar = alCerrar
        this.element = null
        this.temporizador = null
        this.cerrado = false
    }

    render() {
        const { rol, vivo, icono: nombreIcono } = this.def

        const elemento = document.createElement("div")
        elemento.className = `notification glass notification--${this.tipo}`
        elemento.setAttribute("role", rol)
        elemento.setAttribute("aria-live", vivo)
        if (this.duracion) {
            elemento.style.setProperty("--duracion", `${this.duracion}ms`)
        }

        const insignia = document.createElement("span")
        insignia.className = "notification__icon"
        insignia.appendChild(icon(nombreIcono, { size: 20 }))

        const cuerpo = document.createElement("div")
        cuerpo.className = "notification__body"

        if (this.titulo) {
            const cabecera = document.createElement("p")
            cabecera.className = "notification__title"
            cabecera.textContent = this.titulo
            cuerpo.appendChild(cabecera)
        }

        const texto = document.createElement("p")
        texto.className = "notification__text"
        texto.textContent = this.mensaje
        cuerpo.appendChild(texto)

        if (this.accion) {
            const boton = document.createElement("button")
            boton.type = "button"
            boton.className = "notification__action"
            boton.textContent = this.accion.label || "Ver"
            boton.addEventListener("click", () => {
                this.accion.onClick?.(this)
                this.ocultar()
            })
            cuerpo.appendChild(boton)
        }

        const cerrar = document.createElement("button")
        cerrar.type = "button"
        cerrar.className = "notification__close"
        cerrar.setAttribute("aria-label", "Cerrar aviso")
        cerrar.appendChild(icon("x", { size: 16 }))
        cerrar.addEventListener("click", () => this.ocultar())

        if (this.duracion) {
            const barra = document.createElement("span")
            barra.className = "notification__progress"
            elemento.appendChild(barra)
        }

        elemento.append(insignia, cuerpo, cerrar)

        // pausa la cuenta atras con el puntero encima: si hay una accion
        // que pulsar, el aviso no puede desaparecerle de la mano
        elemento.addEventListener("mouseenter", () => this.pausar())
        elemento.addEventListener("mouseleave", () => this.reanudar())

        this.element = elemento
        return elemento
    }

    show() {
        if (!this.element) this.render()

        contenedor().appendChild(this.element)
        vivas.add(this)
        this.acotar()

        // reflow forzado: asienta el estado inicial (translateX fuera de
        // pantalla) para que la transicion arranque al anadir .visible.
        // No usamos requestAnimationFrame porque se pausa en pestanas
        // ocultas: un aviso disparado en segundo plano se quedaria invisible.
        void this.element.offsetWidth
        this.element.classList.add("visible")

        this.arrancar()
        return this
    }

    /** Como mucho MAX_VISIBLES a la vez: si no, tapan la pagina. */
    acotar() {
        while (vivas.size > MAX_VISIBLES) {
            const masVieja = vivas.values().next().value
            masVieja.ocultar()
        }
    }

    arrancar() {
        if (!this.duracion || this.cerrado || this.temporizador) return
        this.temporizador = setTimeout(() => this.ocultar(), this.duracion)
    }

    pausar() {
        if (!this.temporizador) return
        clearTimeout(this.temporizador)
        this.temporizador = null
    }

    reanudar() {
        this.arrancar()
    }

    ocultar() {
        if (this.cerrado || !this.element) return
        this.cerrado = true
        this.pausar()
        vivas.delete(this)

        const elemento = this.element
        elemento.classList.remove("visible")
        this.alCerrar?.(this)

        setTimeout(() => elemento.remove(), 400)
    }
}

/** Firma historica: la que usan notify.js y los controladores de panel. */
function notificar(mensaje, tipo = "info", duracion = 4000) {
    return new Notification({ mensaje, tipo, duracion }).show()
}

/** Cierra todo lo que haya en pantalla. Para cambios de vista. */
function cerrarNotificaciones() {
    Array.from(vivas).forEach(n => n.ocultar())
}

export { Notification, notificar, cerrarNotificaciones, contenedor }

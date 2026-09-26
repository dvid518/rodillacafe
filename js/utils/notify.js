import { notificar } from "../components/Notification.js"
import { Modal } from "../components/Modal.js"
import { escaparHTML } from "./format.js"

export function notifySuccess(mensaje, duracion) {
    notificar(mensaje, "success", duracion)
}

export function notifyError(mensaje, duracion) {
    notificar(mensaje, "error", duracion)
}

export function notifyWarning(mensaje, duracion) {
    notificar(mensaje, "warning", duracion)
}

export function notifyInfo(mensaje, duracion) {
    notificar(mensaje, "info", duracion)
}

export function notifyConfirm(mensaje, { title = "Confirmar", labelAceptar = "Aceptar", labelCancelar = "Cancelar" } = {}) {
    return new Promise(resolve => {
        const modal = new Modal({
            title,
            body: escaparHTML(mensaje),
            actions: [
                {
                    label: labelCancelar,
                    className: "cancel-btn",
                    onClick: modal => {
                        resolve(false)
                        modal.close()
                    },
                },
                {
                    label: labelAceptar,
                    className: "delete-btn",
                    onClick: modal => {
                        resolve(true)
                        modal.close()
                    },
                },
            ],
            onClose: () => resolve(false),
        })
        modal.open()
    })
}
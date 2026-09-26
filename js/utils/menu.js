import { esperar } from "./dom.js"

const items = ["index-i", "menu-i", "nosotros-i", "contacto-i", "reserva-i"]

export async function showMenu() {
    const menu = document.getElementById("menu")
    if (!menu) return
    menu.classList.add("active")

    for (let i = 0; i < items.length; i++) {
        await esperar(75)
        const item = document.getElementById(items[i])
        if (item) item.classList.add("act")
    }
}

export async function hideMenu() {
    const menu = document.getElementById("menu")
    if (!menu) return
    for (let i = items.length - 1; i >= 0; i--) {
        await esperar(75)
        const item = document.getElementById(items[i])
        if (item) item.classList.remove("act")
    }
    menu.classList.remove("active")
}
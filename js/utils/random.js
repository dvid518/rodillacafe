const fondos = { light: ["light1", "light2"], dark: ["dark1", "dark2"] }

export function getRandomBg(theme) {
    const lista = fondos[theme]
    return lista[Math.floor(Math.random() * lista.length)]
}

// El tema vive en <html data-theme="...">, no en una clase del body.
export function temaActual() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark"
}

export function randomBackground() {
    const body = document.body

    if (body.classList.contains("login")) {
        body.classList.add("bg-login")
        return
    }

    // home, panel, admin y cuenta fijan su propio fondo desde su hoja de
    // pagina. Ojo: los HTML de admin y de mi-cuenta llevan las DOS clases
    // ("panel admin", "panel cuenta"), asi que la comprobacion de "panel"
    // ya los cubria; el resto es defensa por si alguna vez se quita "panel".
    if (body.classList.contains("home") ||
        body.classList.contains("panel") ||
        body.classList.contains("admin") ||
        body.classList.contains("cuenta")) {
        return
    }

    const bg = getRandomBg(temaActual())

    body.classList.remove("bg-dark1", "bg-dark2", "bg-light1", "bg-light2")
    body.classList.add("bg-" + bg)
}

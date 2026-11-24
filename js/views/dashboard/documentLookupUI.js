// Each form owns a guard. Invalidating releases its busy state immediately;
// only the current request can later release that state or update the form.
export function createLookupGuard(setBusy) {
    let active = null
    function invalidate() {
        if (!active) return
        active = null
        setBusy(false)
    }
    return {
        invalidate,
        start(matches) {
            if (active) return null
            const request = {
                current: () => active === request && matches(),
                finish: () => { if (active === request) invalidate() },
            }
            active = request
            setBusy(true)
            return request
        },
    }
}

export function fillLookupFields(entries, edited = new Set(), applied = new Map()) {
    for (const [field, value] of entries) {
        if (!field || field.value !== "" || edited.has(field) || !value) continue
        field.value = value
        applied.set(field, value)
    }
}

export function trackLookupFields(fields) {
    const edited = new Set()
    const applied = new Map()
    for (const field of fields.filter(Boolean)) {
        field.addEventListener("input", () => { edited.add(field); applied.delete(field) })
    }
    return {
        fill: entries => fillLookupFields(entries, edited, applied),
        documentChanged() {
            for (const [field, value] of applied) {
                if (field.value === value) field.value = ""
            }
            applied.clear()
        },
        reset() { edited.clear(); applied.clear() },
    }
}

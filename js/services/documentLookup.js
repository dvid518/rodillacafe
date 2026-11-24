const messages = {
    VALIDATION: "Documento inválido",
    AUTH_REQUIRED: "Inicia sesión para consultar el documento",
    FORBIDDEN: "No tienes permiso para consultar el documento",
    NOT_FOUND: "No se encontró el documento",
    PROVIDER_AUTH: "El proveedor no está disponible por un problema de autorización",
    SECRETS_MISSING: "El servicio de consulta no está configurado",
    RATE_LIMITED: "Se alcanzó el límite de consultas. Intenta más tarde",
    NETWORK_ERROR: "No se pudo conectar con el servicio de consulta",
    TIMEOUT: "La consulta tardó demasiado",
    SUPABASE_UNAVAILABLE: "No se pudo consultar la base de datos",
    PROVIDER_UNAVAILABLE: "El proveedor de documentos no está disponible",
    INVALID_JSON: "El servicio devolvió una respuesta ilegible",
    INVALID_RESPONSE: "El servicio devolvió datos inválidos del documento",
    INTERNAL: "No se pudo consultar el documento",
}

export function lookupFailure(code, message = messages[code]) {
    return { ok: false, error: { code, message } }
}

export function exactDocument(value, digits) {
    const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value
    return typeof text === "string" && text.length === digits && !/[^0-9]/.test(text) ? text : null
}

// Some SDK operations wait for auth before fetch; abort alone cannot bound that wait.
export async function withLookupDeadline(work, timeoutMs = 15_000) {
    const controller = new AbortController()
    let timer
    const deadline = new Promise(resolve => {
        timer = setTimeout(() => {
            resolve(lookupFailure("TIMEOUT"))
            controller.abort()
        }, timeoutMs)
    })
    try {
        return await Promise.race([deadline, Promise.resolve().then(() => work(controller.signal))])
    } finally {
        clearTimeout(timer)
    }
}

export async function readLookupRow(query, signal) {
    try {
        if (signal.aborted) return lookupFailure("TIMEOUT")
        const request = query().abortSignal(signal)
        if (typeof request.retry === "function") request.retry(false)
        const { data, error } = await request.maybeSingle()
        if (signal.aborted) return lookupFailure("TIMEOUT")
        if (error || data === undefined) return lookupFailure("SUPABASE_UNAVAILABLE")
        return { ok: true, data }
    } catch {
        return lookupFailure(signal.aborted ? "TIMEOUT" : "SUPABASE_UNAVAILABLE")
    }
}

function envelopeCode(payload) {
    return payload?.ok === false && typeof payload.error === "string" &&
        typeof payload.code === "string" && Object.hasOwn(messages, payload.code) ? payload.code : null
}

const statusCodes = new Map([
    [400, "VALIDATION"], [401, "AUTH_REQUIRED"], [403, "FORBIDDEN"],
    [429, "RATE_LIMITED"], [502, "PROVIDER_UNAVAILABLE"], [503, "SUPABASE_UNAVAILABLE"],
    [504, "TIMEOUT"],
])

async function invokeError(error) {
    if (error.name === "FunctionsHttpError") {
        const response = error.context
        let code
        try { code = envelopeCode(await response.json()) } catch { /* gateway or non-JSON error */ }
        // A bare 404 could be a missing function, not a missing document.
        if (code === "NOT_FOUND" && response?.status !== 404) code = null
        return lookupFailure(code || statusCodes.get(response?.status) || "INTERNAL")
    }
    if (error.name === "FunctionsFetchError" || error instanceof TypeError) return lookupFailure("NETWORK_ERROR")
    if (error.name === "FunctionsRelayError") return lookupFailure("SUPABASE_UNAVAILABLE")
    if (error instanceof SyntaxError) return lookupFailure("INVALID_JSON")
    return lookupFailure("INTERNAL")
}

export function readActiveDocument(client, table, column, fields, document, signal) {
    return readLookupRow(() => client.from(table).select(fields).eq(column, document).eq("ESTADO", "1"), signal)
}

export function createDocumentLookup(client, { kind, digits, table, column, fields, normalizeDB, normalizeEdge }) {
    return async function lookup(value, signal) {
        const document = exactDocument(value, digits)
        if (!document) return lookupFailure("VALIDATION", `El ${kind.toUpperCase()} debe tener ${digits} dígitos`)

        const run = async activeSignal => {
            const row = await readActiveDocument(client, table, column, fields, document, activeSignal)
            if (!row.ok) return row
            if (row.data !== null) {
                if (exactDocument(row.data?.[column], digits) !== document) return lookupFailure("INVALID_RESPONSE")
                return { ok: true, data: { ...normalizeDB(row.data), [kind]: document, yaExiste: true } }
            }
            if (activeSignal.aborted) return lookupFailure("TIMEOUT")

            const failure = error => activeSignal.aborted ? lookupFailure("TIMEOUT") : invokeError(error)
            let response
            try {
                response = await client.functions.invoke(`consultar-${kind}`, {
                    body: { [kind]: document }, signal: activeSignal,
                })
            } catch (error) {
                return failure(error)
            }
            if (response?.error) return failure(response.error)
            if (activeSignal.aborted) return lookupFailure("TIMEOUT")
            const envelope = response?.data
            if (envelope?.ok !== true) return lookupFailure(envelopeCode(envelope) || "INVALID_RESPONSE")
            const payload = envelope.data
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) return lookupFailure("INVALID_RESPONSE")
            const identities = [payload.numero, payload[kind]].filter(identity => identity != null)
            if (!identities.length || identities.some(identity => exactDocument(identity, digits) !== document)) {
                return lookupFailure("INVALID_RESPONSE")
            }
            return { ok: true, data: { ...normalizeEdge(payload), [kind]: document, yaExiste: false } }
        }
        return signal ? run(signal) : withLookupDeadline(run)
    }
}

export const lookupText = (...values) => values.find(value => typeof value === "string" && value.trim()) || ""

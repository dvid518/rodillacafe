const TOTAL_MS = 12_000
const ATTEMPT_MS = 5_000
const MAX_RETRY_DELAY_MS = 2_000
const DEFAULT_ORIGIN = 'https://rodillacafe.vercel.app'

const DOCUMENTS = {
    dni: { length: 8, fields: ['nombres', 'apellido_paterno', 'apellido_materno'] },
    ruc: { length: 11, fields: [
        'nombre_o_razon_social', 'direccion', 'direccion_completa', 'nombre_comercial',
        'estado', 'condicion', 'distrito', 'provincia', 'departamento', 'telefono', 'email',
    ] },
} as const

const ERRORS = {
    VALIDATION: [400, 'Solicitud de documento inválida.'],
    AUTH_REQUIRED: [401, 'Inicia sesión para consultar documentos.'],
    FORBIDDEN: [403, 'No tienes permiso para realizar esta consulta.'],
    NOT_FOUND: [404, 'No se encontró información del documento.'],
    PROVIDER_AUTH: [502, 'El proveedor rechazó la autorización.'],
    SECRETS_MISSING: [500, 'La consulta de documentos no está configurada.'],
    RATE_LIMITED: [429, 'Se alcanzó el límite de consultas del proveedor.'],
    NETWORK_ERROR: [502, 'No se pudo conectar con el proveedor.'],
    TIMEOUT: [504, 'La consulta excedió el tiempo de espera.'],
    SUPABASE_UNAVAILABLE: [503, 'No se pudo verificar el acceso a la consulta.'],
    PROVIDER_UNAVAILABLE: [502, 'El proveedor no está disponible.'],
    INVALID_JSON: [502, 'El proveedor no devolvió JSON válido.'],
    INVALID_RESPONSE: [502, 'El proveedor devolvió datos inválidos.'],
    INTERNAL: [500, 'No se pudo completar la consulta.'],
} as const

type Code = keyof typeof ERRORS

class LookupFailure extends Error {
    readonly code: Code
    readonly status: number
    readonly retryAfter?: number

    constructor(code: Code, status: number = ERRORS[code][0], retryAfter?: number) {
        super(ERRORS[code][1])
        this.code = code
        this.status = status
        this.retryAfter = retryAfter
    }
}

type Dependencies = {
    getEnv: (name: string) => string | undefined
    fetch: typeof fetch
    now?: () => number
    wallNow?: () => number
    random?: () => number
    sleep?: (ms: number) => Promise<void>
    setTimer?: typeof setTimeout
    clearTimer?: typeof clearTimeout
}

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function documentedAbsence(payload: unknown, kind: keyof typeof DOCUMENTS, document: string): boolean {
    if (!record(payload) || payload.status !== 404 || typeof payload.message !== 'string') return false
    const message = payload.message.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\.$/, '')
    return message === `no se encontro informacion con el numero de ${kind}: ${document}`
}

// Return seconds, distinguishing an absent header from one that cannot safely be honored.
function retryAfterSeconds(value: string | null, wallNow: () => number): number | null | undefined {
    if (value === null) return undefined
    if (/^[0-9]+$/.test(value)) {
        const seconds = Number(value)
        return Number.isSafeInteger(seconds) ? seconds : null
    }
    if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return null
    const date = Date.parse(value)
    return Number.isFinite(date) ? Math.max(0, Math.ceil((date - wallNow()) / 1000)) : null
}

export function createDocumentHandler(kind: keyof typeof DOCUMENTS, deps: Dependencies) {
    const { getEnv, fetch: fetchImpl, now = () => performance.now(), wallNow = Date.now,
        random = Math.random, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
        setTimer = setTimeout, clearTimer = clearTimeout } = deps
    const spec = DOCUMENTS[kind]

    return async (request: Request): Promise<Response> => {
        const start = now()
        const remaining = () => TOTAL_MS - (now() - start)
        const headers = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' })
        const fail = (error: LookupFailure) => {
            if (error.retryAfter !== undefined) headers.set('Retry-After', String(error.retryAfter))
            return Response.json({ ok: false, error: error.message, code: error.code }, { status: error.status, headers })
        }

        async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, budget = remaining()): Promise<T> {
            if (budget <= 0) throw new LookupFailure('TIMEOUT')
            const started = now()
            const controller = new AbortController()
            const timeout = new LookupFailure('TIMEOUT')
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
                const expired = new Promise<never>((_, reject) => {
                    timer = setTimer(() => { reject(timeout); controller.abort() }, budget)
                })
                const value = await Promise.race([expired, work(controller.signal)])
                if (now() - started >= budget || remaining() <= 0) {
                    controller.abort()
                    throw timeout
                }
                return value
            } finally {
                if (timer !== undefined) clearTimer(timer)
            }
        }

        try {
            const origin = request.headers.get('Origin')
            const origins = (getEnv('DOCUMENT_LOOKUP_ORIGINS') ?? DEFAULT_ORIGIN).split(',').map(value => value.trim())
            if (origin !== null && (origin === 'null' || origin === '*' || !origin || !origins.includes(origin))) {
                return fail(new LookupFailure('FORBIDDEN'))
            }
            if (origin !== null) {
                headers.set('Access-Control-Allow-Origin', origin)
                headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
                headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
                headers.set('Access-Control-Expose-Headers', 'Retry-After')
            }
            if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
            if (request.method !== 'POST') {
                headers.set('Allow', 'POST, OPTIONS')
                return fail(new LookupFailure('VALIDATION', 405))
            }
            const authorization = request.headers.get('Authorization')
            if (!authorization || !/^Bearer [^\s,]+$/i.test(authorization)) throw new LookupFailure('AUTH_REQUIRED')

            const input = await bounded(async () => {
                try { return await request.json() } catch { throw new LookupFailure('VALIDATION') }
            })
            const candidate = record(input) ? input[kind] : undefined
            if (typeof candidate !== 'string' || candidate.length !== spec.length || /[^0-9]/.test(candidate)) {
                throw new LookupFailure('VALIDATION')
            }
            const document: string = candidate
            const base = getEnv('SUPABASE_URL')?.trim().replace(/\/+$/, '')
            const anonKey = getEnv('SUPABASE_ANON_KEY')?.trim()
            if (!base || !anonKey) throw new LookupFailure('SECRETS_MISSING')

            async function supabase(path: string, body?: object) {
                return await bounded(async signal => {
                    try {
                        const response = await fetchImpl(`${base}${path}`, {
                            method: body ? 'POST' : 'GET', redirect: 'error', signal,
                            headers: { apikey: anonKey!, Authorization: authorization!, 'Content-Type': 'application/json' },
                            body: body ? JSON.stringify(body) : undefined,
                        })
                        if (path === '/auth/v1/user' && [401, 403].includes(response.status)) {
                            throw new LookupFailure('AUTH_REQUIRED')
                        }
                        if (response.status !== 200) throw new LookupFailure('SUPABASE_UNAVAILABLE')
                        return await response.json()
                    } catch (error) {
                        if (error instanceof LookupFailure) throw error
                        throw new LookupFailure('SUPABASE_UNAVAILABLE')
                    }
                })
            }
            const user = await supabase('/auth/v1/user')
            if (!record(user) || typeof user.id !== 'string' || !user.id.trim()) throw new LookupFailure('SUPABASE_UNAVAILABLE')

            async function role(name: string, body: object) {
                const value = await supabase(`/rest/v1/rpc/${name}`, body)
                if (typeof value !== 'boolean') throw new LookupFailure('SUPABASE_UNAVAILABLE')
                return value
            }
            if (!await role('is_admin', {}) && !await role('is_rol', { p_rol: 'CAJERO' })) {
                throw new LookupFailure('FORBIDDEN')
            }
            const key = getEnv('FACTILIZA_KEY_1')?.trim() || getEnv('FACTILIZA_KEY_2')?.trim() || getEnv('FACTILIZA_KEY_3')?.trim()
            if (!key) throw new LookupFailure('SECRETS_MISSING')

            async function attempt() {
                return await bounded(async signal => {
                    let response: Response
                    try {
                        response = await fetchImpl(`https://api.factiliza.com/v1/${kind}/info/${document}`, {
                            headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
                            redirect: 'error', signal,
                        })
                    } catch {
                        throw new LookupFailure('NETWORK_ERROR')
                    }
                    const status = response.status
                    if (status === 429 || status === 503) {
                        void response.body?.cancel().catch(() => {})
                        return { status, retryAfter: retryAfterSeconds(response.headers.get('Retry-After'), wallNow) } as const
                    }
                    if (status !== 200 && status !== 404) {
                        void response.body?.cancel().catch(() => {})
                        throw new LookupFailure(status === 401 || status === 403 ? 'PROVIDER_AUTH' : 'PROVIDER_UNAVAILABLE')
                    }
                    let payload: unknown
                    try { payload = await response.json() } catch {
                        throw new LookupFailure(status === 404 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_JSON')
                    }
                    if (status === 404) throw new LookupFailure(documentedAbsence(payload, kind, document) ? 'NOT_FOUND' : 'PROVIDER_UNAVAILABLE')
                    if (!record(payload) || payload.status !== 200 || !record(payload.data) || payload.data.numero !== document) {
                        throw new LookupFailure('INVALID_RESPONSE')
                    }
                    const data: Record<string, string> = { numero: document }
                    for (const field of spec.fields) {
                        const value = payload.data[field]
                        if (value === null || value === undefined) continue
                        if (typeof value !== 'string') throw new LookupFailure('INVALID_RESPONSE')
                        data[field] = value
                    }
                    if (!data[spec.fields[0]]?.trim()) throw new LookupFailure('INVALID_RESPONSE')
                    return { status, data } as const
                }, Math.min(remaining(), ATTEMPT_MS))
            }

            let result = await attempt()
            // Only an explicit 503 is replayable, on the same key, with room for a full attempt.
            if (result.status === 503 && result.retryAfter !== null) {
                const delay = (result.retryAfter ?? 0) * 1000 + 100 + Math.floor(random() * 151)
                if (delay <= MAX_RETRY_DELAY_MS && delay + ATTEMPT_MS < remaining()) {
                    await bounded(() => sleep(delay))
                    if (remaining() >= ATTEMPT_MS) result = await attempt()
                }
            }
            if (result.status === 200) return Response.json({ ok: true, data: result.data }, { headers })
            throw new LookupFailure(result.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
                result.status, result.retryAfter ?? undefined)
        } catch (error) {
            return fail(error instanceof LookupFailure ? error : new LookupFailure('INTERNAL'))
        }
    }
}

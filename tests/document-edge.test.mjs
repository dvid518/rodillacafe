import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDocumentHandler } from '../supabase/functions/_shared/document-lookup.ts'

const prod = 'https://rodillacafe.vercel.app'
const supabase = 'https://synthetic.invalid'
const env = {
    SUPABASE_URL: supabase, SUPABASE_ANON_KEY: 'synthetic-anon',
    FACTILIZA_KEY_2: 'synthetic-second', FACTILIZA_KEY_3: 'synthetic-third',
}
const json = (value, status = 200, headers) => Response.json(value, { status, headers })

function fixture({ kind = 'dni', config = env, admin = true, cashier = false,
    user = () => json({ id: 'synthetic-user' }), provider, timing } = {}) {
    const calls = []
    const doc = kind === 'dni' ? '01234567' : '01234567890'
    const data = kind === 'dni'
        ? { numero: doc, nombres: 'Ejemplo', apellido_paterno: 'Prueba' }
        : { numero: doc, nombre_o_razon_social: 'Ejemplo', direccion: 'Prueba' }
    const handler = createDocumentHandler(kind, {
        getEnv: key => config[key], ...timing,
        fetch: async (url, options) => {
            calls.push({ url, ...options })
            switch (url) {
                case `${supabase}/auth/v1/user`: return user()
                case `${supabase}/rest/v1/rpc/is_admin`: return json(admin)
                case `${supabase}/rest/v1/rpc/is_rol`: return json(cashier)
                case `https://api.factiliza.com/v1/${kind}/info/${doc}`:
                    return provider ? provider(options) : json({ status: 200, data: { ...data, extra: 'discard' } })
                default: throw new Error('Unexpected mock route')
            }
        },
    })
    const send = ({ origin = prod, bearer = 'Bearer caller', method = 'POST', body = JSON.stringify({ [kind]: doc }) } = {}) => {
        const headers = { 'Content-Type': 'application/json' }
        if (origin) headers.Origin = origin
        if (bearer) headers.Authorization = bearer
        return handler(new Request('https://edge.invalid', { method, headers, body: method === 'POST' ? body : undefined }))
    }
    return { calls, send, data }
}

async function failure(response, status, code) {
    assert.equal(response.status, status)
    const body = await response.json()
    assert.deepEqual(body, { ok: false, error: body.error, code })
    assert.equal(typeof body.error, 'string')
    assert.doesNotMatch(body.error, /synthetic|caller|01234567/)
}

for (const kind of ['dni', 'ruc']) {
    test(`${kind}: caller authentication, roles and allowlisted success`, async () => {
        const { send, calls, data } = fixture({ kind, admin: kind === 'dni', cashier: true })
        const response = await send()
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { ok: true, data })
        for (const call of calls.slice(0, -1)) {
            const headers = new Headers(call.headers)
            assert.equal(headers.get('apikey'), 'synthetic-anon')
            assert.equal(headers.get('authorization'), 'Bearer caller')
        }
        assert.equal(calls[0].url, `${supabase}/auth/v1/user`)
        assert.equal(calls[1].url, `${supabase}/rest/v1/rpc/is_admin`)
        assert.equal(calls.length, kind === 'dni' ? 3 : 4)
        if (kind === 'ruc') {
            assert.equal(calls[2].url, `${supabase}/rest/v1/rpc/is_rol`)
            assert.deepEqual(JSON.parse(calls[2].body), { p_rol: 'CAJERO' })
        }
        assert.equal(new Headers(calls.at(-1).headers).get('authorization'), 'Bearer synthetic-second')
    })
}

test('exact CORS only; preflight never calls dependencies and CORS does not authorize', async () => {
    const { send, calls } = fixture()
    const allowed = await send({ method: 'OPTIONS', bearer: '' })
    assert.equal(allowed.status, 204)
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), prod)
    assert.match(allowed.headers.get('Vary'), /Origin/i)
    const denied = await send({ origin: `${prod}.invalid` })
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null)
    await failure(denied, 403, 'FORBIDDEN')
    await failure(await send({ bearer: '' }), 401, 'AUTH_REQUIRED')
    const custom = fixture({ config: { ...env, DOCUMENT_LOOKUP_ORIGINS: 'https://one.invalid, https://two.invalid' } })
    assert.equal((await custom.send({ method: 'OPTIONS', origin: 'https://two.invalid' })).headers.get('Access-Control-Allow-Origin'), 'https://two.invalid')
    await failure(await custom.send(), 403, 'FORBIDDEN')
    assert.equal(calls.length + custom.calls.length, 0)
})

test('malformed documents never invoke the provider', async () => {
    const { send, calls } = fixture()
    for (const body of ['{', 'null', '{"dni":12345678}', '{"dni":"01234567\\n"}', '{"dni":"0123-4567"}']) {
        await failure(await send({ body }), 400, 'VALIDATION')
    }
    assert.equal(calls.filter(call => call.url.includes('factiliza')).length, 0)
})

test('fails closed on expired auth, role denial, malformed role and Auth outage', async () => {
    for (const [config, status, code, count] of [
        [{ user: () => json({}, 401) }, 401, 'AUTH_REQUIRED', 1],
        [{ user: () => json({}, 503) }, 503, 'SUPABASE_UNAVAILABLE', 1],
        [{ user: () => json({}) }, 503, 'SUPABASE_UNAVAILABLE', 1],
        [{ admin: false }, 403, 'FORBIDDEN', 3],
        [{ admin: 'true', cashier: true }, 503, 'SUPABASE_UNAVAILABLE', 2],
        [{ config: { SUPABASE_URL: supabase, SUPABASE_ANON_KEY: 'synthetic-anon' } }, 500, 'SECRETS_MISSING', 2],
    ]) {
        const { send, calls } = fixture(config)
        await failure(await send({ origin: '' }), status, code)
        assert.equal(calls.length, count)
        assert.ok(calls.every(call => call.url.startsWith(supabase)))
    }
})

test('provider failures never rotate and only documented absence becomes 404', async () => {
    for (const [provider, status, code] of [
        [() => json({ status: 404, message: 'No se encontro información con el numero de DNI: 01234567' }, 404), 404, 'NOT_FOUND'],
        [() => json({ status: 404, message: 'No se encontro información con el numero de DNI: 12345678' }, 404), 502, 'PROVIDER_UNAVAILABLE'],
        [() => json({ status: 404, message: 'Ruta no encontrada' }, 404), 502, 'PROVIDER_UNAVAILABLE'],
        [() => json({ status: 404, message: 'No se encontró información' }, 502), 502, 'PROVIDER_UNAVAILABLE'],
        [() => json({}, 401), 502, 'PROVIDER_AUTH'],
        [() => json({}, 429, { 'Retry-After': '15' }), 429, 'RATE_LIMITED'],
        [() => { throw new Error('synthetic private error') }, 502, 'NETWORK_ERROR'],
        [() => new Response('bad'), 502, 'INVALID_JSON'],
        [() => json({ status: 200, data: { numero: '12345678', nombres: 'Otro' } }), 502, 'INVALID_RESPONSE'],
        [() => json({ status: 200, data: { numero: '01234567', nombres: {} } }), 502, 'INVALID_RESPONSE'],
        [() => json({ status: 200, data: { numero: '01234567', nombres: ' ' } }), 502, 'INVALID_RESPONSE'],
    ]) {
        const { send, calls } = fixture({ provider })
        const response = await send()
        await failure(response, status, code)
        if (status === 429) assert.equal(response.headers.get('Retry-After'), '15')
        assert.equal(calls.length, 3)
    }
})

test('documented RUC absence returns 404 only for the requested document', async () => {
    const { send, calls } = fixture({ kind: 'ruc', provider: () => json({
        status: 404, message: 'No se encontro información con el numero de RUC: 01234567890',
    }, 404) })
    await failure(await send(), 404, 'NOT_FOUND')
    assert.equal(calls.length, 3)
})

test('one bounded 503 retry can recover with a successful response', async () => {
    let attempts = 0
    const { send, calls, data } = fixture({
        provider: () => ++attempts === 1 ? json({}, 503) : json({ status: 200, data }),
        timing: { random: () => 0, sleep: async () => {} },
    })
    assert.deepEqual(await (await send()).json(), { ok: true, data })
    assert.equal(calls.length, 4)
})

test('one bounded 503 retry on the same key, respecting Retry-After and budget', async () => {
    for (const [retryAfter, expectedDelays] of [['1', [1100]], ['60', []], ['garbage', []]]) {
        let now = 0
        const delays = []
        const { send, calls } = fixture({
            provider: () => json({}, 503, { 'Retry-After': retryAfter }),
            timing: { now: () => now, random: () => 0, sleep: async ms => { delays.push(ms); now += ms } },
        })
        const result = await send()
        await failure(result, 503, 'PROVIDER_UNAVAILABLE')
        assert.deepEqual(delays, expectedDelays)
        assert.equal(calls.length, 3 + expectedDelays.length)
        for (const call of calls.slice(2)) assert.equal(new Headers(call.headers).get('authorization'), 'Bearer synthetic-second')
    }
})

test('provider deadline covers response body and aborts without replay', async () => {
    const timers = []
    const { send, calls } = fixture({
        timing: { setTimer: (fn, ms) => { timers.push({ fn, ms }); return fn }, clearTimer: () => {} },
        provider: () => ({ status: 200, json: () => new Promise(() => { timers.at(-1).fn() }) }),
    })
    await failure(await send(), 504, 'TIMEOUT')
    assert.equal(timers.at(-1).ms, 5000)
    assert.equal(calls.length, 3)
    assert.equal(calls.at(-1).signal.aborted, true)
})

test('total deadline caps Auth and can prevent a 503 retry late in the request', async () => {
    let now = 0
    const timers = []
    const { send, calls } = fixture({
        timing: { now: () => now, setTimer: (fn, ms) => { timers.push(ms); return fn }, clearTimer: () => {} },
        user: () => { now = 8000; return json({ id: 'synthetic-user' }) },
        provider: () => json({}, 503),
    })
    await failure(await send(), 503, 'PROVIDER_UNAVAILABLE')
    assert.equal(timers[0], 12000)
    assert.equal(timers.at(-1), 4000)
    assert.equal(calls.length, 3)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Substitute only the browser transport and the write adapter. No network.
const client = globalThis.documentTestClient = { functions: {} }
const adapter = globalThis.documentTestAdapter = {}
const hooks = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('/js/lib/supabaseClient.js')) return {
            format: 'module', shortCircuit: true, source: 'export const supabase = globalThis.documentTestClient',
        }
        if (url.endsWith('/js/adapters/UserAdapter.js')) return {
            format: 'module', shortCircuit: true, source: 'export const UserAdapter = globalThis.documentTestAdapter',
        }
        if (url.endsWith('/js/adapters/AuthAdapter.js')) return {
            format: 'module', shortCircuit: true, source: 'export const AuthAdapter = {}',
        }
        return nextLoad(url, context)
    },
})
const { consultarDNI } = await import('../js/services/dniService.js')
const { consultarRUC } = await import('../js/services/rucService.js')
const { userService } = await import('../js/services/userService.js')
hooks.deregister()

function mock(row, edge) {
    const calls = []
    client.from = table => {
        calls.push(table)
        const query = {
            select: () => query, eq: () => query,
            abortSignal(signal) { calls.push(signal); return query },
            maybeSingle: async () => row,
        }
        return query
    }
    client.functions.invoke = async (name, options) => {
        calls.push([name, options]); return edge
    }
    return calls
}

test('exact digits; invalid input does not call DB or Edge', async () => {
    const calls = mock({ data: null }, {})
    assert.equal((await consultarRUC('20-123456789')).error.code, 'VALIDATION')
    assert.equal((await consultarDNI(' 12345678 ')).error.code, 'VALIDATION')
    assert.deepEqual(calls, [])
})

test('DB-first uses a signal and preserves normalized contacts', async () => {
    const calls = mock({ data: { N_Documento: '01234567', Nombre: 'Ana', EMAIL: 'mock@example.test' } })
    const result = await consultarDNI('01234567')
    assert.equal(result.data.dni, '01234567')
    assert.equal(result.data.email, 'mock@example.test')
    assert.equal(result.data.yaExiste, true)
    assert.equal(calls[0], 'PERSONA')
    assert.ok(calls[1] instanceof AbortSignal)
    assert.equal(calls.length, 2)
})

test('DB failure is not absence, even if the response includes data', async () => {
    const calls = mock({ data: { N_Documento: '12345678' }, error: { message: 'private details' } })
    const result = await consultarDNI('12345678')
    assert.equal(result.error.code, 'SUPABASE_UNAVAILABLE')
    assert.doesNotMatch(result.error.message, /private/)
    assert.equal(calls.length, 2)
})

test('a clean miss calls only the Edge Function with the same deadline signal', async () => {
    const calls = mock({ data: null }, { data: { ok: true, data: { numero: '20123456789', nombre_o_razon_social: 'Empresa', direccion_completa: 'Dirección' } } })
    const result = await consultarRUC('20123456789')
    assert.equal(result.data.razonSocial, 'Empresa')
    assert.equal(result.data.direccionCompleta, 'Dirección')
    assert.equal(result.data.yaExiste, false)
    assert.equal(calls[0], 'EMPRESA')
    assert.deepEqual(calls[2], ['consultar-ruc', { body: { ruc: '20123456789' }, signal: calls[1] }])
})

test('reject mismatched or decorated document identities', async () => {
    mock({ data: null }, { data: { ok: true, data: { numero: '0123-4567', nombres: 'Ana' } } })
    assert.equal((await consultarDNI('01234567')).error.code, 'INVALID_RESPONSE')
    mock({ data: { RUC: '20999999999' } })
    assert.equal((await consultarRUC('20123456789')).error.code, 'INVALID_RESPONSE')
})

test('normalize FunctionsHttpError JSON without exposing provider text', async () => {
    const error = Object.assign(new Error('private SDK details'), {
        name: 'FunctionsHttpError',
        context: new Response(JSON.stringify({ ok: false, code: 'PROVIDER_UNAVAILABLE', error: 'private provider details' }), { status: 503 }),
    })
    mock({ data: null }, { error })
    const result = await consultarDNI('12345678')
    assert.equal(result.error.code, 'PROVIDER_UNAVAILABLE')
    assert.doesNotMatch(result.error.message, /private/)
})

test('user DB failure cannot be bypassed by lookup or registration', async () => {
    const calls = mock({ data: null, error: { message: 'offline' } }, { data: { ok: true, data: { numero: '12345678', nombres: 'Ana' } } })
    adapter.buscarUsuarioPorDNI = async () => ({ ok: true, data: null }) // legacy adapter can mask PERSONA errors
    let writes = 0
    adapter.crearUsuarioManual = async () => { writes++; return { ok: true } }
    assert.equal((await userService.buscarORegistrarUsuarioPorDNI('12345678', { registrarAutomaticamente: true })).error.code, 'SUPABASE_UNAVAILABLE')
    assert.equal((await userService.registrarUsuarioManual({ nDocumento: '12345678' })).error.code, 'SUPABASE_UNAVAILABLE')
    assert.equal(writes, 0)
    assert.ok(calls.every(call => !Array.isArray(call)))
})

test('deadline bounds a hung DB or SDK auth wait, aborting without retries', async () => {
    const { withLookupDeadline } = await import('../js/services/documentLookup.js')
    let signal
    const result = await withLookupDeadline(activeSignal => {
        signal = activeSignal
        return new Promise(() => {})
    }, 5)
    assert.equal(result.error.code, 'TIMEOUT')
    assert.equal(signal.aborted, true)
})

test('lookup UI guards duplicates and stale responses, and only fills untouched fields', async () => {
    const { createLookupGuard, fillLookupFields } = await import('../js/views/dashboard/documentLookupUI.js')
    const loading = []
    const guard = createLookupGuard(value => loading.push(value))
    let doc = '12345678'
    const first = guard.start(() => doc === '12345678')
    assert.equal(guard.start(() => true), null)
    doc = '87654321'
    guard.invalidate()
    const second = guard.start(() => doc === '87654321')
    first.finish()
    assert.equal(first.current(), false)
    assert.equal(second.current(), true)
    const manual = { value: 'Manual' }
    const blank = { value: '' }
    fillLookupFields([[manual, 'Auto'], [blank, 'Auto']])
    assert.equal(manual.value, 'Manual')
    assert.equal(blank.value, 'Auto')
    second.finish()
    assert.deepEqual(loading, [true, false, true, false])
})

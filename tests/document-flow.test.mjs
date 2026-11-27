import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { createDocumentHandler } from '../supabase/functions/_shared/document-lookup.ts'

// Load the actual browser services without downloading the CDN SDK or opening a socket.
const client = {}
globalThis.__documentFlowTestClient = client
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('https://esm.sh/@supabase/supabase-js@')) {
            return { url: 'data:text/javascript,export const createClient=()=>globalThis.__documentFlowTestClient', shortCircuit: true }
        }
        return nextResolve(specifier, context)
    },
})
const { consultarDNI } = await import('../js/services/dniService.js')
const { consultarRUC } = await import('../js/services/rucService.js')
hooks.deregister()
delete globalThis.__documentFlowTestClient

for (const { kind, lookup, doc, table, column, row, providerData, display, field } of [
    { kind: 'dni', lookup: consultarDNI, doc: '01234567', table: 'PERSONA', column: 'N_Documento', row: { Nombre: 'Nombre local' }, providerData: { nombres: 'Nombre externo' }, field: 'nombres', display: 'Nombre externo' },
    { kind: 'ruc', lookup: consultarRUC, doc: '01234567890', table: 'EMPRESA', column: 'RUC', row: { Razon_Social: 'Empresa local' }, providerData: { nombre_o_razon_social: 'Empresa externa' }, field: 'razonSocial', display: 'Empresa externa' },
]) {
    test(`${kind}: browser service, Edge and provider contract with synthetic transports`, async () => {
        let dbResult = { data: { [column]: doc, ...row }, error: null }
        let result = Response.json({ status: 200, data: { numero: doc, ...providerData } })
        let invokes = 0
        let providerCalls = 0
        const handler = createDocumentHandler(kind, {
            getEnv: name => ({ SUPABASE_URL: 'https://auth.invalid', SUPABASE_ANON_KEY: 'synthetic-public', FACTILIZA_KEY_1: 'synthetic-provider' })[name],
            fetch: async url => {
                if (url === 'https://auth.invalid/auth/v1/user') return Response.json({ id: 'synthetic-user' })
                if (url === 'https://auth.invalid/rest/v1/rpc/is_admin') return Response.json(true)
                assert.equal(url, `https://api.factiliza.com/v1/${kind}/info/${doc}`)
                providerCalls++
                return result
            },
        })
        client.from = name => {
            assert.equal(name, table)
            return {
                select() { return this },
                eq(key, value) { assert.equal(value, key === column ? doc : '1'); return this },
                abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this },
                async maybeSingle() { return dbResult },
            }
        }
        client.functions = {
            async invoke(name, { body, signal }) {
                assert.equal(name, `consultar-${kind}`)
                assert.deepEqual(body, { [kind]: doc })
                invokes++
                const reply = await handler(new Request('https://edge.invalid', {
                    method: 'POST', headers: { Authorization: 'Bearer synthetic-user' }, body: JSON.stringify(body), signal,
                }))
                if (reply.ok) return { data: await reply.json(), error: null }
                return { data: null, error: { name: 'FunctionsHttpError', context: reply } }
            },
        }

        const local = await lookup(doc)
        assert.equal(local.ok, true)
        assert.equal(local.data[kind], doc)
        assert.equal(local.data.yaExiste, true)
        assert.equal(local.data[field], Object.values(row)[0])
        assert.equal(invokes, 0)

        dbResult = { data: null, error: { message: 'synthetic internal detail' } }
        assert.equal((await lookup(doc)).error.code, 'SUPABASE_UNAVAILABLE')
        assert.equal(invokes, 0)

        dbResult = { data: null, error: null }
        const external = await lookup(doc)
        assert.equal(external.ok, true)
        assert.equal(external.data[kind], doc)
        assert.equal(external.data.yaExiste, false)
        assert.equal(external.data[field], display)

        result = Response.json({ status: 404, message: `No se encontro información con el numero de ${kind.toUpperCase()}: ${doc}` }, { status: 404 })
        const absent = await lookup(doc)
        assert.equal(absent.ok, false)
        assert.equal(absent.error.code, 'NOT_FOUND')
        assert.ok(!absent.error.message.includes(doc))

        result = Response.json({}, { status: 429, headers: { 'Retry-After': '30' } })
        assert.equal((await lookup(doc)).error.code, 'RATE_LIMITED')
        assert.equal(invokes, 3)
        assert.equal(providerCalls, 3)
    })
}

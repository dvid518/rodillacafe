import { createDocumentHandler } from '../_shared/document-lookup.ts'

Deno.serve(createDocumentHandler('ruc', {
    getEnv: name => Deno.env.get(name),
    fetch: (input, init) => fetch(input, init),
}))

import { createDocumentHandler } from '../_shared/document-lookup.ts'

Deno.serve(createDocumentHandler('dni', {
    getEnv: name => Deno.env.get(name),
    fetch: (input, init) => fetch(input, init),
}))

import { supabase } from "../lib/supabaseClient.js"
import { createDocumentLookup, lookupText } from "./documentLookup.js"

export const consultarDNI = createDocumentLookup(supabase, {
    kind: "dni", digits: 8, table: "PERSONA", column: "N_Documento",
    fields: "N_Documento, Nombre, Ap_Paterno, Ap_Materno, EMAIL, Celular",
    normalizeDB: row => ({
        nombres: lookupText(row.Nombre),
        apellidoPaterno: lookupText(row.Ap_Paterno),
        apellidoMaterno: lookupText(row.Ap_Materno),
        email: lookupText(row.EMAIL),
        celular: lookupText(row.Celular),
    }),
    normalizeEdge: data => ({
        nombres: lookupText(data.nombres, data.nombre),
        apellidoPaterno: lookupText(data.apellido_paterno, data.apellidoPaterno, data.paterno, data.apellido),
        apellidoMaterno: lookupText(data.apellido_materno, data.apellidoMaterno, data.materno),
    }),
})

export const dniService = { consultarDNI }

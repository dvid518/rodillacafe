import { supabase } from "../lib/supabaseClient.js"
import { createDocumentLookup, lookupText } from "./documentLookup.js"

export const consultarRUC = createDocumentLookup(supabase, {
    kind: "ruc", digits: 11, table: "EMPRESA", column: "RUC",
    fields: "RUC, Razon_Social, Nombre_Comercial, Direccion, Telefono, EMAIL",
    normalizeDB: row => ({
        razonSocial: lookupText(row.Razon_Social),
        direccion: lookupText(row.Direccion),
        direccionCompleta: "",
        nombreComercial: lookupText(row.Nombre_Comercial),
        estado: "", condicion: "", distrito: "", provincia: "", departamento: "",
        telefono: lookupText(row.Telefono),
        email: lookupText(row.EMAIL),
    }),
    normalizeEdge: data => ({
        razonSocial: lookupText(data.nombre_o_razon_social),
        direccion: lookupText(data.direccion),
        direccionCompleta: lookupText(data.direccion_completa),
        nombreComercial: lookupText(data.nombre_comercial),
        estado: lookupText(data.estado),
        condicion: lookupText(data.condicion),
        distrito: lookupText(data.distrito),
        provincia: lookupText(data.provincia),
        departamento: lookupText(data.departamento),
        telefono: lookupText(data.telefono),
        email: lookupText(data.email),
    }),
})

export const rucService = { consultarRUC }

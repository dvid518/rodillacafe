import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS })
    }

    try {
        const { ruc } = await req.json()
        const rucLimpio = String(ruc || "").replace(/\D/g, "")
        if (rucLimpio.length !== 11) {
            return new Response(JSON.stringify({ ok: false, error: "RUC debe tener 11 dígitos" }), {
                status: 400,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            })
        }

        // Las claves leen de variables de entorno secretas de Supabase (nunca hardcodeadas).
        const keys = [
            Deno.env.get("FACTILIZA_KEY_1"),
            Deno.env.get("FACTILIZA_KEY_2"),
            Deno.env.get("FACTILIZA_KEY_3"),
        ].filter(Boolean)

        if (keys.length === 0) {
            return new Response(JSON.stringify({ ok: false, error: "No hay claves configuradas" }), {
                status: 500,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            })
        }

        let ultimoError = null
        for (const key of keys) {
            try {
                const resp = await fetch(`https://api.factiliza.com/v1/ruc/info/${rucLimpio}`, {
                    headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
                })
                const json = await resp.json()
                if (json.success && json.data) {
                    return new Response(JSON.stringify({ ok: true, data: json.data }), {
                        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
                    })
                }
                ultimoError = json.message || "RUC no encontrado"
            } catch (e) {
                ultimoError = e.message
            }
        }

        return new Response(JSON.stringify({ ok: false, error: ultimoError }), {
            status: 404,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        })
    } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        })
    }
})

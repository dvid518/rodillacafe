/* ==========================================================================
   CONFIG — parametros del proyecto en un unico sitio
   --------------------------------------------------------------------------
   Antes la URL y la clave vivian dentro de js/lib/supabaseClient.js. Cuando
   el proyecto de Supabase cambia (o se crea uno nuevo) habia que acordarse de
   tocar el fichero correcto; aqui sestedian las dos cosas juntas, que es como
   estan en el panel de Supabase: "Project URL" y "Publishable key".

   Que cambiar cuando algo falla con ERR_NAME_NOT_RESOLVED:
     1. SUPABASE_URL debe ser EXACTAMENTE la "Project URL" del panel. El host
        es <ref>.supabase.co, donde <ref> es el identificador del proyecto. Si
        el proyecto se borro o se renombro, ese host deja de existir en DNS y
        todo lo que sale de aqui falla antes de llegar al servidor.
     2. SUPABASE_ANON_KEY es la "Publishable key" (sb_publishable_...). La key
        antigua "anon" con formato JWT tambien funciona.

   La clave va incrustada en el bundle publico POR DISENO: es la clave
   publica, y lo que protege los datos son las policies de RLS del SQL
   (sql/014_rls_policies.sql y sql/018_fixes.sql). El secreto de servicio
   nunca va aqui.
   ========================================================================== */

export const SUPABASE_URL = "https://zmksxwgikagorgyeyhli.supabase.co"

export const SUPABASE_ANON_KEY = "sb_publishable_pwGnTUrnhSeGKood5uWXPg_rEutuOXH"

/* ==========================================================================
   CONSULTA DE DNI — múltiples claves de API con fallback
   --------------------------------------------------------------------------
   Cuando se da de alta un usuario manualmente y no existe en la BD, se
   consulta a un servicio externo de DNI (token). Si una clave falla se pasa
   a la siguiente hasta agotarlas; el usuario nunca se entera de que una
   clave falló. Solo se notifica cuando TODAS las claves están agotadas.

   API_DNI_URL: plantilla con {dni} y {key}. Si una entrada no lleva clave
   (key: null), el {key} se omite de la URL.
   ========================================================================== */

export const API_DNI_URL = "https://dniruc.apisperu.com/api/v1/dni/{dni}?token={key}"

export const API_KEYS_DNI = [
    // Reemplaza con tus claves reales. El sistema las prueba en orden.
    // Ejemplo: "tu-token-aqui-1", "tu-token-aqui-2", "tu-token-aqui-3"
]
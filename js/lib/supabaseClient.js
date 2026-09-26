import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = "https://zmksxwgikagorgyeyhli.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_pwGnTUrnhSeGKood5uWXPg_rEutuOXH"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
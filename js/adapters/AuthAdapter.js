import { supabase } from "../lib/supabaseClient.js"

async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function signUp(email, password, nombre) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre } }
    })
    if (error) return { ok: false, error }
    return { ok: true, data }
}

async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) return { ok: false, error }
    return { ok: true, data: null }
}

async function getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) return { ok: false, error }
    return { ok: true, data: data.session }
}

function onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
}

export const AuthAdapter = { signIn, signUp, signOut, getSession, onAuthChange }
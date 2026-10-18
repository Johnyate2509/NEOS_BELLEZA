import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno de Vite.")
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Usado en flujos administrativos que crean otra cuenta con signUp: esta
// instancia aislada evita reemplazar o emitir eventos en la sesión del admin.
export const supabaseAuthIsolated = createClient(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
		detectSessionInUrl: false,
	},
})

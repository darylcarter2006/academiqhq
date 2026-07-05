import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[AcademiqHQ] Supabase env vars missing — auth will not work. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

// createClient throws on an empty URL, which would crash the whole bundle at
// module load (before the ErrorBoundary mounts). Placeholders keep the app
// usable without Supabase env vars — auth calls just fail gracefully.
export const supabase = createClient(
  supabaseUrl || 'https://unconfigured.supabase.co',
  supabaseAnonKey || 'unconfigured',
)

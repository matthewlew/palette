import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Missing config (e.g. CI/test without .env.local). Fall back to a syntactically
  // valid placeholder so createClient doesn't throw at import time — actual calls
  // will just fail, which callers already handle. Real values come from the
  // VITE_SUPABASE_* env at build time.
  console.error("Missing Supabase URL or Anon Key. Check your .env.local file.")
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)

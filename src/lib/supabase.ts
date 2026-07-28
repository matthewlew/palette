import { createClient } from '@supabase/supabase-js'
import { getClientId } from './clientId'

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
  {
    global: {
      // Echoes this browser's anonymous client id on every request. The RLS
      // policies on palette_likes read it (see supabase/migrations/0002) so a
      // like can only be written or removed under the id that sent it — the
      // closest thing to ownership there is without accounts.
      headers: { 'x-palette-client': getClientId() },
    },
  },
)

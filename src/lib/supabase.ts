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

// The `x-palette-client` header this used to send is gone. It echoed a client
// id the browser minted itself, which the palette_likes policies read as if it
// were an identity — anyone could forge one, and 0002 said so. Every browser
// now has a real session, so migration 0006 repointed those policies at
// auth.uid() and the header has nothing left to prove.

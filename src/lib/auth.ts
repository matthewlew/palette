import { supabase } from './supabase'

let bootstrapping: Promise<void> | null = null

/**
 * Guarantees this browser has a session — anonymous if nothing else. Safe to
 * call from anywhere on load; concurrent callers share one in-flight request.
 *
 * Deliberately does not retry in a loop: Supabase rate-limits anonymous
 * sign-in per IP (~30/hour), and a busy retry would make that worse, not
 * better. A failure here leaves the app sessionless — the public feed and
 * local saves still work, publishing and liking don't. See plan §13.
 */
export function ensureSession(): Promise<void> {
  if (bootstrapping) return bootstrapping

  bootstrapping = (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return

    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      // Leave bootstrapping resolved (not rejected) so callers don't treat a
      // degraded, sessionless app as a crash. The next page load tries again.
      console.error('Anonymous sign-in failed:', error.message)
    }
  })()

  return bootstrapping
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

/**
 * Attaches a Google identity to the current (anonymous) session's uid. On
 * `identity_already_exists` that Google account is already the owner of a
 * different uid — the merge case in plan §6 — and the caller is expected to
 * fall through to signInWithGoogle() to sign in as that existing account.
 */
export async function linkGoogle(): Promise<void> {
  // No session to link onto — anonymous sign-in is disabled, rate limited, or
  // storage is blocked (plan §13). Plain OAuth still works and still produces
  // an account; all that is lost is the "nothing migrates" property, because
  // there were no anonymous-owned rows to carry over in the first place.
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    await signInWithGoogle()
    return
  }

  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

/**
 * Signs out and immediately re-bootstraps a fresh anonymous session, so the
 * app is never sessionless after a deliberate sign-out — see plan §6c.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  bootstrapping = null
  await ensureSession()
}

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

/**
 * Marks that a sign-in redirect is in flight, so the page that comes back can
 * tell "the user just signed in" from "the user was already signed in".
 *
 * OAuth is a full page navigation: the app is torn down and rebuilt, and the
 * session is already named by first render. Nothing held in a ref or in React
 * state survives to observe the transition, so the intent has to be written
 * somewhere that outlives the document. sessionStorage rather than
 * localStorage, so it dies with the tab and cannot make a later cold start
 * announce a sign-in that happened yesterday.
 */
const SIGN_IN_PENDING_KEY = 'palette-sign-in-pending'

/**
 * The uid this browser held when it left for Google, so the page that comes
 * back can fold that session's work into whatever account it lands in (plan
 * §6). Same reasoning as the mark above: the redirect destroys the document,
 * and after it the old uid is simply gone.
 */
const PRIOR_UID_KEY = 'palette-prior-uid'

function markSignInPending(priorUid?: string): void {
  try {
    sessionStorage.setItem(SIGN_IN_PENDING_KEY, '1')
    if (priorUid) sessionStorage.setItem(PRIOR_UID_KEY, priorUid)
  } catch {
    // Storage blocked (plan §13). The sign-in still works; it just completes
    // without the confirmation toast, and without merging.
  }
}

/** The pre-redirect uid, once. Clears it. */
export function consumePriorUid(): string | null {
  try {
    const uid = sessionStorage.getItem(PRIOR_UID_KEY)
    if (uid) sessionStorage.removeItem(PRIOR_UID_KEY)
    return uid
  } catch {
    return null
  }
}

/** True exactly once per completed sign-in redirect. Clears the mark. */
export function consumeSignInPending(): boolean {
  try {
    if (sessionStorage.getItem(SIGN_IN_PENDING_KEY) === null) return false
    sessionStorage.removeItem(SIGN_IN_PENDING_KEY)
    return true
  } catch {
    return false
  }
}

export async function signInWithGoogle(): Promise<void> {
  // Whatever session is being left behind — anonymous, in the ordinary case.
  // Recorded before the redirect because afterwards there is no way to ask.
  const { data } = await supabase.auth.getSession()
  markSignInPending(data.session?.user.id)

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

  // On the happy path linkIdentity keeps this very uid, so the merge that
  // reads this is a no-op. It matters on the fallback below, where Google
  // already owns a different account and this session is left behind.
  markSignInPending(data.session.user.id)

  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo },
  })
  if (!error) return

  // That Google account already owns a different uid — the merge case in plan
  // §6, which happens on any second sign-in (another browser, or after a
  // sign-out). Signing in as the account that already exists is correct on its
  // own and is what the user asked for; folding this browser's anonymous rows
  // into it is the separate, deferred half (step 6). Without this fallback,
  // signing back in after signing out simply fails.
  if (isIdentityAlreadyExists(error)) {
    await signInWithGoogle()
    return
  }

  throw error
}

function isIdentityAlreadyExists(error: { code?: string; message?: string }): boolean {
  if (error.code === 'identity_already_exists') return true
  return (error.message ?? '').toLowerCase().includes('already')
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

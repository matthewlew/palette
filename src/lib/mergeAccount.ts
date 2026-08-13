import { supabase } from './supabase'

/**
 * Folds a left-behind anonymous session into the account just signed into —
 * accounts plan §6.
 *
 * Runs silently rather than asking. Claiming asks because it infers ownership
 * from a colour match and could be wrong about a stranger's gradient; here the
 * browser actually held the session being merged, so there is no inference to
 * consent to — it is the user's own work following them, and a prompt would be
 * asking permission to do the obviously correct thing.
 *
 * A no-op on the ordinary path: linking Google keeps the same uid, so there is
 * nothing left behind to fold in.
 */
export async function mergeAnonymousAccount(priorUid: string): Promise<number> {
  const { data, error } = await supabase.rpc('merge_anonymous_account', {
    p_anon_id: priorUid,
  })
  if (error) throw error
  return (data as number) ?? 0
}

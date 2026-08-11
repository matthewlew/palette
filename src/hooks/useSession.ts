import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/auth'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface SessionState {
  user: User | null
  profile: Profile | null
  /** True once there's a session but it has no linked (non-anonymous) identity. */
  isAnonymous: boolean
  /** True while the initial bootstrap + profile fetch is in flight. */
  loading: boolean
}

const INITIAL_STATE: SessionState = {
  user: null,
  profile: null,
  isAnonymous: true,
  loading: true,
}

/**
 * The live answer to "who is this?" — bootstraps an anonymous session on
 * mount if there isn't one yet, then tracks auth state and the matching
 * profile row for as long as the component using it is alive.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false

    async function loadProfile(user: User | null): Promise<Profile | null> {
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      return data
    }

    async function sync(user: User | null) {
      const profile = await loadProfile(user)
      if (cancelled) return
      setState({
        user,
        profile,
        isAnonymous: user ? user.is_anonymous === true : true,
        loading: false,
      })
    }

    ensureSession().then(async () => {
      if (cancelled) return
      const { data } = await supabase.auth.getSession()
      await sync(data.session?.user ?? null)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void sync(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  return state
}

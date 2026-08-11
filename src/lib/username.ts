import { supabase } from './supabase'
import { isProfane } from './profanity'

const SHAPE_RE = /^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])?$/

const RESERVED = new Set([
  'admin', 'administrator', 'root', 'support', 'help',
  'palette', 'api', 'about', 'settings', 'account',
  'login', 'signin', 'signup', 'signout', 'logout',
  'me', 'you', 'null', 'undefined', 'anonymous',
])

export type UsernameProblem =
  | 'too-short'
  | 'too-long'
  | 'bad-characters'
  | 'edge-underscore'
  | 'reserved'
  | 'profane'

/** Lowercases and trims. Display keeps what was typed; this is for checks/storage keys. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Local, synchronous checks only — shape, reserved words, profanity. Does not
 * check availability, which needs a round trip; see isAvailable below.
 */
export function checkUsername(raw: string): UsernameProblem | null {
  const username = normalizeUsername(raw)

  if (username.length < 3) return 'too-short'
  if (username.length > 20) return 'too-long'
  if (username.startsWith('_') || username.endsWith('_')) return 'edge-underscore'
  if (!SHAPE_RE.test(username)) return 'bad-characters'
  if (RESERVED.has(username)) return 'reserved'
  if (isProfane(username)) return 'profane'

  return null
}

/**
 * Availability against the server. Only meaningful when checkUsername already
 * passed — this does not repeat the local checks. The unique index on
 * profiles.username is the real authority; this is a courtesy check to avoid
 * a round trip that's certain to fail, not a guarantee against a race.
 */
export async function isAvailable(raw: string): Promise<boolean> {
  const username = normalizeUsername(raw)
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) throw error
  return data === null
}

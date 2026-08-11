# Accounts and attribution — implementation plan

Sign-in, usernames, and a visible author on every gradient, at no added running
cost. Everything below fits inside the Supabase free tier the app already uses.

Status: **plan only**. Nothing here is built yet.

---

## 1. Why anonymous-first

The tempting shape is "add a Sign in button, then migrate the user's
localStorage saves onto their new account when they use it." That shape has a
claiming step, and a claiming step has a bad case: a shared or public browser,
where the previous person's gradients get swept into the first account that
signs in on it.

So: **every browser gets a real auth session on first load**, via
`supabase.auth.signInAnonymously()`. Signing in with Google then calls
`linkIdentity({ provider: 'google' })`, which attaches a Google identity to the
*same* `auth.uid()`. Nothing migrates, because nothing changed hands — the rows
were already owned by the uid that just grew a name.

Consequences worth stating up front:

- `x-palette-client` and `src/lib/clientId.ts` can retire. `auth.uid()` replaces
  it in the `palette_likes` RLS policies (migration 0004 below), which upgrades
  likes from a forgeable header to a signed JWT claim.
- Anonymous users count against the free tier's 50k monthly actives. Current
  traffic is nowhere near that, and Supabase reaps unconfirmed anonymous users
  on a schedule.
- Manual linking must be switched on in the Supabase dashboard
  (Authentication → Providers → "Allow manual linking").
- Linking fails with `identity_already_exists` when that Google account is
  already attached to a different uid — i.e. the user signed in on another
  browser first. That is the one case where a real merge is needed; see §6.

No email/password, and no magic links. The free tier's built-in SMTP is
throttled to a couple of messages an hour and is not meant for real traffic, so
email is the one auth method that would eventually cost money. Google only at
launch; Apple and GitHub are the same three lines when wanted.

---

## 2. Schema

### `0003_add_accounts.sql`

```sql
create extension if not exists citext;

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  constraint username_shape check (username ~ '^[a-z0-9](?:[a-z0-9_]{1,18}[a-z0-9])$')
);
```

- `citext` so `@Ada` and `@ada` are the same handle and cannot both exist.
- 3–20 chars, lowercase alnum + underscore, no leading/trailing underscore.
- A `reserved_usernames` table (admin, palette, support, api, help, about, …)
  checked by the same RPC that checks availability.
- Profanity: `src/lib/profanity.ts` client-side for the instant "pick another",
  plus the same word list in the `claim_username` RPC so it is actually
  enforced rather than merely suggested.

RLS: `select` true for everyone — a byline is public by definition. `insert`
and `update` restricted to `id = auth.uid()`. No `delete` policy; account
deletion cascades from `auth.users`.

### Author column

```sql
alter table public.palettes
  add column author_id uuid references auth.users(id) on delete set null;
create index palettes_author_idx on public.palettes (author_id, created_at desc);
```

`on delete set null`, not cascade: deleting an account must not delete the
gradients other people have saved and liked. The work stays, the byline goes.

RLS on `palettes` tightens to: read all, insert only with
`author_id = auth.uid()`, update/delete only your own rows. Today anon can
insert freely; that stays possible only because every browser now has a uid.

### Saved palettes

`saved` currently lives in Zustand `persist` under `palette-saved-gradients` and
exists only in that browser. It becomes a server table with localStorage as an
offline cache, not the source of truth:

```sql
create table public.palette_saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  palette_id <palettes.id type> not null references public.palettes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, palette_id)
);
```

Same shape as `palette_likes`, same RLS pattern (`user_id = auth.uid()`).

Private lists are explicitly out of scope — **every gradient is public**. There
is no visibility column, and adding one later is an `alter table`, not a
redesign.

### `0004_likes_on_auth_uid.sql`

Repoints the three `palette_likes` policies from
`current_setting('request.headers')::json->>'x-palette-client'` to `auth.uid()`,
and backfills `client_id` → `user_id` where a mapping exists (it mostly will
not; unmappable likes keep their counts and lose their owner, which only means
those browsers can no longer un-like).

Ships **after** anonymous sessions are live in production, never before — the
policies would reject every write from an un-upgraded bundle.

---

## 3. Client code

New:

| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | `ensureSession()` (anonymous bootstrap, idempotent), `signInWithGoogle()`, `signOut()`, `linkGoogle()` |
| `src/lib/username.ts` | normalise, validate shape, reserved + profanity check, `isAvailable()` |
| `src/hooks/useSession.ts` | `onAuthStateChange` subscription → `{ user, profile, isAnonymous, loading }` |

Changed:

- `src/lib/supabase.ts` — drop the `x-palette-client` header once 0004 lands.
- `src/lib/publishPalette.ts` — write `author_id`.
- `src/lib/paletteRow.ts` — `PaletteRow` gains `author_id` and an embedded
  `author: { username }`; `toGradient` maps it onto `Gradient.author`.
- `src/hooks/useCommunityGradients.ts` — `select('*, author:profiles(username)')`.
  Left join, so unattributed rows keep rendering.
- `src/store/types.ts` — `Gradient.author?: { id: string; username: string }`.
- `src/store/useAppStore.ts` — `saved` syncs through `palette_saves`; persist
  version 7 → 8 with a migration that leaves the local array intact and lets
  the first authed sync reconcile.

**No new components.** The UI is LDS classes on existing markup:

- Sign in lives in the nav slot already drawn for it — `.lds-btn` in
  `.headerActions`, swapping to the avatar/username chip (`.lds-chip`) when
  signed in.
- The sign-in sheet and the username picker are both `.lds-modal`.
- The byline is a text run on the tile and in the viewer, using the existing
  subdued type scale — no new component, no new icon.

---

## 4. Username flow

Signing in with Google does not give you a handle; it gives you an identity that
has not chosen one yet. First sign-in therefore lands on a blocking
`.lds-modal`: pick a username, validated live, `claim_username` RPC on submit
(one round trip, uniqueness enforced by the index rather than by a check-then-
insert race).

A signed-in user with no profile row is a legal state — they closed the modal.
They can browse, save, and like; publishing re-opens the picker, because a
gradient cannot be published without a byline to put on it.

---

## 5. Legacy rows — claimable by DNA match

The ~119 existing rows have no author. They stay `author_id = null` and render
with no byline, which is honest: nobody signed them.

On first sign-in, the app compares the DNA (`paletteDna` — shape + ordered
hexes) of every locally saved gradient against unattributed rows, and offers
whatever matches: *"You have 4 gradients that look like yours. Claim them?"*
Explicit, listed with previews, opt-in per batch — not silent.

A `claim_palettes(dna text[])` RPC does the work `security definer`, and will
only ever set `author_id` on a row where it is currently **null**. A claimed
gradient can never be re-claimed, so the first person to sign in with a matching
local save wins. That is a guess, not proof — two people who generated the same
gradient could each have a local copy — but it only ever fires on rows nobody
owns, and the cost of being wrong is a byline, not a loss.

---

## 6. Duplicates

Names are deterministic from colours and their order (`namePalette`), so two
genuinely identical gradients also produce an identical name. That makes exact
collisions rare rather than routine, and the existing slug loop already handles
them by numbering: `Ash Vellum`, then `Ash Vellum 2`.

With authors, one adjustment. Today `publishPalette` short-circuits on a
DNA match and returns the *existing* row. That is right when the same person
republishes their own gradient (a re-share should not spawn a second copy) and
wrong when a different person publishes it, because it silently files their work
under somebody else's byline. So:

- same DNA, **same** `author_id` → reuse the row, as today
- same DNA, **different** author → new row, next available name, its own byline

Identity is the row id; the name is a label. The feed already dedupes by DNA
for display, so a duplicate does not double up on screen — the earliest row
shows, and both authors keep a row they own.

There is no co-ownership table and no merge UI. If duplicates turn out to be
common enough to matter, that is the moment to reconsider, not now.

### Account-merge case

When Google linking fails because that identity is already on another uid, we
sign in as the existing (real) account and offer to fold the anonymous uid's
rows into it — same explicit, listed, opt-in prompt as §5. A
`merge_anonymous(from_uid)` RPC reassigns `palettes.author_id`,
`palette_saves`, and `palette_likes`, then deletes the anonymous user. Only ever
from an anonymous uid to a permanent one, never the reverse.

---

## 7. Export and re-import

Exported JSON carries `author: { id, username }`. On import the gradient keeps
that as **credit**, not ownership: it renders "via @ada" and the importer cannot
publish it under their own name unmodified. Editing it — changing a colour, a
stop, the shape — makes it a new gradient with a new DNA, and the editor becomes
its author with the original retained as `derived_from`. Authorship follows the
work, not possession of the file.

---

## 8. Order of work

Each step is shippable on its own and safe to stop after.

1. **0003** — `profiles`, `palettes.author_id`, `palette_saves`, RLS. App is
   unaffected: the column is nullable and nothing reads it yet.
2. **Auth lib + session hook.** Anonymous bootstrap live in production, no UI.
   This is the step 0004 waits on.
3. **Sign in with Google + username picker.** Both `.lds-modal`.
4. **Write and render attribution.** `author_id` on publish; byline on tile and
   viewer; `/u/:username` is not in this phase.
5. **Saves move server-side**, localStorage demoted to cache.
6. **Claim flow** (§5) and **merge** (§6).
7. **0004** — likes repointed to `auth.uid()`, `clientId.ts` deleted.

## 9. Tests

- `username.ts` — shape, reserved words, profanity, normalisation. Pure, cheap,
  thorough.
- `auth.ts` — mocked Supabase client; bootstrap is idempotent, link failure
  falls through to the merge path.
- `publishPalette` — same-author dedupe reuses, different-author does not.
- `paletteRow` — a row with no author still renders; a row with one carries it.
- RLS is verified by hand against a scratch project. Policies are not unit
  testable from the client, and pretending otherwise is worse than not trying.

## 10. Cost

$0. Supabase free tier: 50k MAU, 500MB database, unlimited API requests. Google
OAuth is free. The one paid trap avoided is transactional email, which is why
there is no email/password option.

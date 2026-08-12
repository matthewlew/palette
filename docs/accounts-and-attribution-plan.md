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

No email/password, and no magic links — a product call, not a budget one. See
§11.

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
sign in as the existing (real) account and fold the anonymous uid's rows into
it automatically, reporting it afterwards with an undo (§6b). A
`merge_anonymous(from_uid)` RPC reassigns `palettes.author_id`,
`palette_saves`, and `palette_likes`, then deletes the anonymous user. Only ever
from an anonymous uid to a permanent one, never the reverse.

---

## 6b. What the user is told when they sign in

Three different things can happen to gradients at sign-in, and they do not
deserve the same treatment. The rule: **ask when rows change owner, confirm
when they don't.**

**Nothing moved — confirm.** The ordinary case. They were signed out, made
gradients, signed in on the same browser. Those rows were written under the
anonymous uid and Google linking attached an identity to that same uid, so
ownership never changed. There is nothing to consent to.

Silence is still wrong, though: from the user's side they were logged out,
made things, and logged in, and the anxiety about whether the work survived is
real even when the risk is not. So a one-line dismissible confirmation, and
deliberately *not* the word "migrated" — it describes a transfer that did not
happen and invites "migrated from where?", which the user cannot answer:

> Signed in as @ada — your 6 gradients are on your account.

**Rows moved — automatic, with an undo.** The merge case in §6: this Google
account already exists on another uid, so the anonymous uid's gradients are
reassigned to it. Not gated behind a prompt — told after the fact:

> Added the 3 gradients you made while signed out. *Not yours? Undo*

An earlier draft made this a consent prompt, on the shared-machine argument.
That argument is mostly wrong, and the reason is §6c: once you sign out, your
rows belong to your **account**, not to the anonymous uid. The anon uid only
ever holds work made since the last sign-out — by whoever is actually sitting
at the browser. When that person signs in, adding it to their collection is
simply correct, and a modal in front of it taxes the common path to guard a
door the ownership model already locked.

The residual misfire is narrow: A signs out, B makes gradients without signing
in, and then **A** returns and signs in. Undo covers it imperfectly. It can
un-sign the rows (`author_id` back to null) but cannot hand them to B — the
anonymous uid is gone and the browser is signed in as A. They sit unattributed,
recoverable only through the §5 claim by someone whose local copy still
matches. A lossy edge, accepted in exchange for not prompting on every
sign-in.

**Someone else's unsigned rows — ask.** The DNA claim in §5 stays explicit.
Different situation: merge *knows* who made the rows, claim is inferring
ownership of rows nobody signed from a colour match that could be coincidence.

---

## 6c. Signing out

`supabase.auth.signOut()`, then straight back into `signInAnonymously()`. The
app is never sessionless — it goes back to being an unnamed browser with a
fresh uid, which is the same state a first-time visitor is in.

### What we say

> **Sign out?** Your gradients stay on your account. They'll be cleared from
> this browser — sign back in to get them.

Not "signing out saves your gradients": that reads as an action being taken at
sign-out and invites "saves them where?". They are already saved. The only
thing changing is what this browser holds.

### The local cache is cleared, and that is the safety story

`palette-saved-gradients` is a **cache** once §2's `palette_saves` is live; the
server holds the truth. Sign-out wipes it, and signing back in refills it from
the server. Nothing is lost because nothing local was authoritative.

Leaving it in place is the actual hazard: the next anonymous session would open
onto the previous person's gallery, and anything re-published from it would
land under a new byline.

**This gates the build order — but less tightly than first written.** The
original rule was that sign-out cannot ship before step 5, because clearing the
cache would destroy real data and not clearing it would leak.

The second half of that is wrong *before* step 5. Until saves are
account-scoped they belong to the browser, exactly as they have for every user
to date, so not clearing them leaks nothing — it preserves current behaviour
rather than changing it. There is no account copy to be out of step with,
because there is no account copy.

So sign-out ships in step 3 in a **non-clearing** form, with copy that says so
("gradients saved on this browser stay on this browser for now"). At step 5
both halves change together: saves become account-scoped, clearing begins, and
the copy becomes §12's. What genuinely cannot ship early is *clearing*, not
sign-out.

The cost of holding sign-out back was concrete and was being paid immediately:
a signed-in user with no way out, and no way to test sign-in twice.

**As built (step 5 landed).** Clearing is now on, but scoped by evidence rather
than by assumption: sign-out clears exactly those gradients carrying a
`paletteId`, which is set only once `savedSync` has recorded the save
server-side. Anything unsynced — saved offline, or a push that failed — stays
on the browser, and the sheet says how many. That is stricter than "flush and
block on it": nothing has to succeed at sign-out time for sign-out to be safe,
because the test is what the server already has rather than what we hope it is
about to accept.

If a save is still pending sync when the user signs out, flush first and block
on it; if the flush fails (offline), say so and let them cancel rather than
silently dropping the write.

### Gradients cannot be pulled into a different account

Not because the prompts are worded carefully — because neither reassignment
path can reach a row owned by a real account:

- **Claim** (§5) only writes `author_id` where it is currently `null`. A row you
  authored is not null, so it is not claimable by anyone, ever, including you.
- **Merge** (§6) only moves rows owned by the **current anonymous uid**. After
  you sign out, your rows belong to your account, not to the fresh anon uid, so
  they are not in the candidate set. The only rows the next person's merge
  prompt can offer are ones they made themselves after you left.

Both scopes are enforced in the RPCs' `where` clauses, not in the UI.

### Saved is not authored

Two different things that "keep my gradients" can mean, and sign-out treats
them differently:

- **Saved** — your shelf. Follows the account: cleared locally on sign-out,
  restored on sign-in.
- **Authored** — public and permanent. Signing out does not unpublish anything
  or strip a byline.

There is deliberately no "take my work back down" action in this plan. If one
is wanted it is a separate feature, and it needs an answer for what happens to
everyone who has already saved that gradient.

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
3. **Sign in with Google + username picker.** Both `.lds-modal`. Sign-*out*
   is held back to step 5 — see §6c.
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
OAuth is free.

An earlier draft said email was excluded on cost grounds. Not quite true, and
worth correcting: Supabase's built-in SMTP is throttled and team-only, but
custom SMTP pointed at Resend's free tier (3,000/month, 100/day) is genuinely
$0 and would carry this app a long way. Excluding email is a **product** call —
see §11.

---

## 11. Providers, and the absence of a sign-up

**Google only at launch.** One button, no inbox round-trip, no deliverability
to operate, and none of the OTP edge cases (expired link, link opened in a
different browser, mail in spam). The anonymous-first model makes it cheap to
be restrictive: someone with no Google account still gets the entire app minus
a byline, because the account is an upgrade rather than a gate. Apple, GitHub
and email-OTP are each one more button and one more provider config when
wanted.

**There is no sign-up.** No separate flow, no "create account" CTA, no
password, no confirm-password, no verification step. Signing in with Google
either finds an identity or mints one. The only moment that resembles
registration is choosing a username, and that is a separate step because it is
a separate decision — a public name, chosen once, that goes on your work.

Copy must never imply an account is being created or that anything is being
transferred. The user's mental model should be: *this browser had my work on
it; now my account does.*

---

## 12. Copy

Voice: plain, second person, no exclamation marks, no "Oops". State what
happened and what to do. Sentence case throughout, matching LDS.

### Nav

| State | Element |
|---|---|
| Signed out | `.lds-btn` — **Sign in** |
| Signed in, has username | `.lds-chip` — avatar + **@ada** |
| Signed in, no username yet | `.lds-chip` — avatar + **Pick a username** |

### Sign-in sheet (`.lds-modal`)

The body changes with the entry point; the title and CTA do not.

**Title:** Sign in to Palette
**CTA:** Continue with Google
**Dismiss:** Not now

Body, from the nav:

> Your gradients live on this browser. Sign in to keep them, put your name on
> what you publish, and pick up where you left off anywhere.

Body, from a publish attempt:

> Published gradients carry their author's name. Sign in to publish this one.

Body, after a failed anonymous bootstrap (§13):

> Sign in to save gradients. This browser isn't holding onto them right now.

There is no legal footnote until there is something to link to. If terms and a
privacy policy exist by launch: *By continuing you agree to the Terms and
Privacy Policy.* — 11px, subdued, links inline.

### Username picker (`.lds-modal`)

**Title:** Pick a username
**Body:** This is the name on every gradient you publish. You can't change it
later.
**Field:** prefix `@`, placeholder `username`
**Hint (resting):** 3–20 characters. Letters, numbers and underscores.
**Primary CTA:** Claim username
**Secondary:** Skip for now

"You can't change it later" is a promise the schema has to keep — see §13. If
renames are allowed instead, the line becomes *You can change it once.* and
`profiles` needs a rename-audit column. Decide before shipping, not after.

Inline validation, replacing the hint:

| Condition | Message |
|---|---|
| Too short | At least 3 characters. |
| Too long | 20 characters max. |
| Bad characters | Letters, numbers and underscores only. |
| Leading/trailing `_` | Can't start or end with an underscore. |
| Taken | @ada is taken. |
| Reserved | That one's reserved. |
| Profane | Pick something else. |
| Available | @ada is available. |
| Checking | (spinner, no text) |

"Pick something else" for profanity is deliberate: no lecture, no naming of
what was matched, no argument to be had with a filter that is sometimes wrong.

### Confirmations and toasts

| Moment | Copy |
|---|---|
| Signed in, nothing moved | Signed in as @ada — your 6 gradients are on your account. |
| Signed in, no gradients yet | Signed in as @ada. |
| Merge (§6b) | Added the 3 gradients you made while signed out. **Not yours? Undo** |
| Undo taken | Removed. Those 3 gradients are unsigned again. |
| Username claimed | You're @ada. |
| Signed out | Signed out. |

Singular/plural handled properly everywhere — "1 gradient", not "1 gradients"
and not "1 gradient(s)".

### Claim prompt (§5, `.lds-modal`)

**Title:** Are these yours?
**Body:** 4 unsigned gradients match ones saved on this browser. Claiming puts
your name on them for good.
**Primary:** Claim 4
**Secondary:** Not mine

Previews in a grid above the buttons. This is the one true consent prompt in
the product, because it is the one place we are inferring rather than knowing.

### Sign out (`.lds-modal`)

**Title:** Sign out?
**Body:** Your gradients stay on your account. They'll be cleared from this
browser — sign back in to get them.
**Primary:** Sign out
**Secondary:** Cancel

If a save is still syncing: **Body appends** — One gradient is still saving.
Sign out will wait for it.

If offline with unsynced work:

> **Title:** Can't sign out yet
> **Body:** One gradient hasn't saved. Signing out now would lose it.
> Reconnect and try again.
> **Primary:** OK

### Delete account (`.lds-modal`)

Reached from the account sheet, never from the nav directly.

**Title:** Delete your account?
**Body:**

> This deletes your username, your saved collection, and your likes.
>
> **Gradients you published stay up.** They're part of the community gallery
> and other people have saved them — they'll just no longer have your name on
> them.
>
> This can't be undone.

**Confirm field label:** Type **delete** to confirm
**Primary (destructive, disabled until matched):** Delete account
**Secondary:** Cancel

**After:** Your account is deleted. — then the app returns to a fresh
anonymous session, i.e. a first-visit state.

The published-gradients paragraph is bold because it is the one thing users
will be wrong about by default. `author_id` is `on delete set null` (§2), so
the work survives and the byline does not. If the intended behaviour is instead
to unpublish, that is a different migration and a different conversation — see
§13.

### Errors

| Case | Copy |
|---|---|
| OAuth popup blocked | Your browser blocked the sign-in window. Allow pop-ups for this site and try again. |
| OAuth cancelled | (silent — the user meant it) |
| OAuth failed | Couldn't reach Google. Try again. |
| Network on username claim | Couldn't save that. Try again. |
| Session expired mid-action | You've been signed out. Sign in to continue. |
| Anonymous bootstrap failed | (silent; app degrades — see §13) |

---

## 13. Edge cases

### Session and bootstrap

**Anonymous sign-in is rate limited.** Supabase caps anonymous sign-ins per IP
(30/hour by default). A school, office or café on one NAT can exhaust it, and
CAPTCHA is the documented mitigation — which we do not want on first load. So
**the app must run with no session at all**: the public feed reads fine (RLS
`select` is `true` for `anon`), local saves keep working out of localStorage,
and only publishing and liking are unavailable. This is exactly today's
behaviour, which makes it a real fallback rather than a theoretical one. Retry
the bootstrap on the next load, never in a loop.

**Storage blocked** (private mode, partitioned storage, strict ITP). The auth
session cannot persist, so every load is a new anonymous user, and saves live
for the session only. Same degraded path as above. `clientId.ts` already
handles this shape and its fallback logic is worth keeping as a reference even
after the file goes.

**Two tabs, sign out in one.** `onAuthStateChange` fires in both — Supabase
broadcasts across tabs on the same origin. The other tab must clear its cache
and re-render as signed out rather than keep a stale gallery on screen.

**Expired JWT.** The client refreshes automatically. A write that fails on an
expired token retries once after a refresh, then surfaces "You've been signed
out."

**Return URL.** The app is served from `/palette/` on GitHub Pages, so
`redirectTo` must be the full base URL, and it must be in the Supabase
allow-list. Getting this wrong lands users on a 404 at the domain root — the
single most likely launch bug in this whole plan.

### Identity

**Google account already linked to another uid** — `identity_already_exists`.
The merge path, §6b. Not surfaced as an error.

**Signing in on a second browser.** Each browser has its own anonymous uid.
The second one merges into the account on sign-in, same as any other merge.
Nothing special.

**Signing in as a different person on a browser that's already signed in.**
Sign out first, which resets to a fresh anon uid; then the normal path. The
account sheet's Sign in link, if shown while signed in, must sign out first
rather than attempt a link.

**Deleted account, then signs in with the same Google account.** A brand new
uid with no history. Their old published gradients are unsigned (`author_id`
null), so the DNA claim in §5 may offer them back if local copies still match
— which is arguably correct, and worth deciding on rather than discovering.

### Usernames

**Taken between the availability check and submit.** The unique index is the
authority; the RPC returns the conflict and the field shows "@ada is taken."
Never check-then-insert.

**Skipped, then publishes.** The picker re-opens; publishing without a byline
is not possible.

**Freed by account deletion.** The row cascades and the handle becomes
available again, which lets someone else become @ada. Their gradients are
already unsigned so nothing is misattributed, but a reader who remembers the
name will be misled. Consider tombstoning handles for 30 days; cheap to add,
awkward to retrofit.

**Case.** `citext` — @Ada and @ada are the same handle. Display preserves what
was typed; uniqueness ignores it.

**Profanity filter is wrong sometimes.** `bad-words` has famous false
positives, and legitimate names will be rejected. There is no appeal path in
this plan, which is a real (small) cost of the "Pick something else" copy.

### Data

**Publishing offline.** Fails as today, caught by the caller. No queue.

**Sign-out with unsynced saves.** Flush and block; refuse if offline (§12).

**Undo after merge.** Un-signs the rows; cannot return them to the anonymous
uid, which no longer exists (§6b).

**A gradient saved by others, then its author deletes their account.** The
gradient stays, `palette_saves` rows for other users are untouched, the byline
goes. Nobody else's collection is affected by someone else's deletion — this
is the whole reason for `on delete set null`.

### Open questions

1. **Username renames.** §12's copy promises "You can't change it later."
   Cheapest to keep and honest, but users will ask. Allowing one rename needs
   an audit column and a decision about whether old bylines re-render.
2. **Does deletion unpublish?** This plan says no, loudly, in the delete copy.
   Reasonable to disagree; changing it means published work can vanish from
   other people's saved collections.
3. **Nudging anonymous users to sign in.** Nothing in this plan pushes anyone
   toward an account. Whether to prompt after N saves, or only at publish, is a
   product call.

---

## 14. Why Supabase Auth and not Clerk

Clerk is the better auth product in general and the wrong fit here. Recorded so
it is not re-litigated from memory.

**Clerk has no anonymous users.** This is decisive. §1's whole mechanism is
that every browser holds a real uid before anyone signs in, so signing in links
an identity onto rows the user already owns and nothing changes hands. Clerk
has no such thing as a user who has not signed in, so the design collapses back
to sign-in-creates-account-then-sweep-localStorage: every sign-in becomes a
migration, and the shared-browser hazard becomes permanent instead of the
narrow case in §6b. §§6b and 6c would both be rewritten in the worse direction.

**No foreign key to `auth.users`.** RLS under Clerk reads
`auth.jwt() ->> 'sub'` — a Clerk user id string, not a uuid in `auth.users`. So
`palettes.author_id` becomes `text` with no FK, `on delete set null` does not
exist, and the deletion behaviour in §12 (published work survives, byline goes)
becomes a webhook to receive and a sweep to write. Receiving a webhook needs a
server. This app has none.

**Its main benefit is a liability here.** What Clerk sells is prebuilt UI —
`<SignIn/>`, `<UserButton/>`, a management dashboard. This app has a design
system it must not deviate from. Theming Clerk into LDS via the appearance API
is more work than the two `.lds-modal`s in §12 and lands less exactly right.

**Verify before relying on these two**, quoted from memory: Clerk's free tier is
around 10k MAU with paid plans from roughly $25/mo, and a *production* Clerk
instance wants DNS records on a domain you control. Palette is served from
`matthewlew.github.io`, where we do not control DNS — if that still holds,
Clerk is not deployable here at all until Palette has its own domain.

**When Clerk would win:** organisations and teams, MFA, many providers with
abuse protection, a real backend, and a custom domain. That is a different
application. Here, auth's entire job is to put a name on a gradient.

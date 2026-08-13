# Supabase — palette backend

Everything here needs **privileged access** (dashboard SQL editor, or the
Supabase CLI logged into your project). The app only ever uses the anon key.

Project ref: `nkmfbeihddctwmtfbvkr`

## First: check what is actually applied

Migrations are applied **by hand**. Nothing reconciles `migrations/` against the
live database and nothing complains when they diverge — a missing table
degrades to an empty feed, a missing function to an RPC that fails at the one
moment a user reaches for it. That is not hypothetical: 0005 sat unapplied
until someone pressed Claim and got `Could not find the function
public.claim_palettes`, months after the file was merged.

So before assuming anything about the database, run
`scripts/check-migrations.sql` in the SQL editor. It prints one row per
expected object, `ok` or `MISSING`. Re-run any file whose row says MISSING.

**0003 through 0008 are all idempotent** (`if not exists`, `create or replace`,
`drop policy if exists`), so running one that was already applied is a no-op
and running the whole set is safe.

## The accounts migrations (0003–0008)

Run in order. Each needs the one before it.

| File | What it adds | If it is missing |
| --- | --- | --- |
| `0003_add_accounts.sql` | `profiles`, `reserved_usernames`, `palette_saves`, `palettes.author_id` | Sign-in cannot store anything |
| `0004_claim_username_rpc.sql` | `claim_username(text)` | The username picker fails |
| `0005_claim_palettes.sql` | `claim_palettes(text[])` | "Are these yours?" appears, then fails on Claim |
| `0006_likes_on_auth_uid.sql` | `palette_likes.user_id`, its indexes and policies | Likes still write under the forgeable client id |
| `0007_merge_anonymous.sql` | `merge_anonymous_account(uuid)` | Anonymous work is stranded after sign-out → sign-in |
| `0008_palettes_readable_by_authenticated.sql` | Widens the `palettes` policies to `authenticated` | Community feed reads empty and publishing fails, both silently |

0008 is worth understanding rather than just running: enabling anonymous auth
reclassified every request in the app from `anon` to `authenticated`, so
policies naming only `anon` stopped matching. The file's own comment has the
detail.

## Run order to ship the older features

### 1. Add the `offsets` column  ← do this FIRST

The app now writes stop offset positions on every save/share. Until the column
exists, those inserts fail (the app catches it and falls back to a plain link),
so run this **before** redeploying the app bundle.

Dashboard → SQL Editor → run `migrations/0001_add_offsets.sql`
(or `supabase db push` if you link the project).

### 1b. Add likes

Dashboard → SQL Editor → run `migrations/0002_add_palette_likes.sql`. Safe to
run twice; it recomputes the counter from the log each time.

**Until it is applied, likes degrade rather than break.** Every palette reads as
0 (`select *` simply comes back without a `likes` column), and tapping a heart
fills it, fails the write, and puts it back — the UI tells the truth about a
signal that is not being recorded yet. Nothing else in the gallery is affected,
so this can ship after the bundle rather than before it.

#### What a like is, and isn't

There are no accounts. A like is attributed to a client id minted in the browser
and kept in localStorage (`src/lib/clientId.ts`), echoed on every request as the
`x-palette-client` header. RLS binds each row to that header, so one browser
cannot write or delete likes under another's id, and the primary key stops it
liking the same palette twice.

That is a **signal, not an identity**. Anyone willing to edit their own header
can forge it, and clearing site data mints a new id and orphans the old likes.
Enough to rank a feed and to train on; not enough for anything that has to be
trustworthy, which needs auth.

The `palette_likes` rows are the part worth keeping — one row per (palette,
client, timestamp) is a dataset, where `palettes.likes` alone is just a number.
The counter exists so the feed can read counts in the select it already makes,
and a trigger keeps the two in agreement.

### 2. Deploy the rich-preview Edge Function

```bash
supabase functions deploy preview --no-verify-jwt          # public: crawlers can't send a JWT
supabase secrets set APP_BASE_URL=https://matthewlew.github.io/palette
```

Test:
- `https://nkmfbeihddctwmtfbvkr.supabase.co/functions/v1/preview/g/<slug>` → HTML with OG tags, redirects to the app
- `https://nkmfbeihddctwmtfbvkr.supabase.co/functions/v1/preview/og/<slug>.png` → 1200×630 image

Validate the card with https://www.opengraph.xyz or by sending yourself the
`/preview/g/<slug>` link in iMessage.

### 3. (Optional) Name any untitled rows

The DB is currently clean (all 119 rows named) and new rows auto-name on insert,
so this is a safety sweep only:

```bash
SUPABASE_URL=https://nkmfbeihddctwmtfbvkr.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx supabase/scripts/name-untitled.mjs           # dry run
# add APPLY=1 to write
```

There is also one leftover test row (`slug = test-slug-2`) worth deleting via the
dashboard.

### 4. Redeploy the app bundle

After step 1, rebuild and copy `dist/` into `matthewlew.github.io/palette/`
(see that repo's deploy notes), commit, push.

## Files
- `migrations/0001_add_offsets.sql` — adds `offsets jsonb`
- `migrations/0002_add_palette_likes.sql` — adds `palette_likes` + `palettes.likes`
- `migrations/0003_add_accounts.sql` … `0008_palettes_readable_by_authenticated.sql` — accounts, attribution, claiming (see the table above)
- `functions/preview/index.ts` — OG HTML + PNG rendering (resvg-wasm)
- `scripts/name-untitled.mjs` — backfill names for empty rows
- `scripts/check-migrations.sql` — reports which migrations this database actually has

Adding a migration? Add it to the table above and to
`scripts/check-migrations.sql` in the same commit. A file nobody knows to run
is the failure mode this section exists to prevent.

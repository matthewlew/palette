# Supabase — palette backend

Everything here needs **privileged access** (dashboard SQL editor, or the
Supabase CLI logged into your project). The app only ever uses the anon key.

Project ref: `nkmfbeihddctwmtfbvkr`

## Run order to ship the new features

### 1. Add the `offsets` column  ← do this FIRST

The app now writes stop offset positions on every save/share. Until the column
exists, those inserts fail (the app catches it and falls back to a plain link),
so run this **before** redeploying the app bundle.

Dashboard → SQL Editor → run `migrations/0001_add_offsets.sql`
(or `supabase db push` if you link the project).

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
- `functions/preview/index.ts` — OG HTML + PNG rendering (resvg-wasm)
- `scripts/name-untitled.mjs` — backfill names for empty rows

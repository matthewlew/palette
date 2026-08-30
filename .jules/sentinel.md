## 2025-02-14 - Prevent PostgREST filter injection and LIKE wildcard abuse in search
**Vulnerability:** User input was directly concatenated into `.or()` and `.ilike()` filters without escaping reserved PostgREST characters (`,`, `.`) or LIKE wildcards (`%`, `_`, `\`).
**Learning:** This could allow attackers to manipulate queries, bypassing intended logic (filter injection via `.or()`) or executing expensive wildcard searches that degrade performance.
**Prevention:** Always sanitize or escape user input by stripping characters like `%`, `_`, `,`, `.`, and `\` before passing them into Supabase/PostgREST filter functions or string templates.

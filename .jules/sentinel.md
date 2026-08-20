## 2023-10-24 - [PostgREST Filter Injection]
**Vulnerability:** Unsanitized user input concatenated into a Supabase/PostgREST `.or()` filter string.
**Learning:** PostgREST uses commas `,` to separate `or` conditions, and `%` and `_` for LIKE wildcard clauses. Failing to sanitize these allowed users to inject arbitrary query conditions or abuse wildcards for denial of service.
**Prevention:** Sanitize user input prior to utilizing them in Supabase queries. For `or()` filters that use commas, strip out punctuation.

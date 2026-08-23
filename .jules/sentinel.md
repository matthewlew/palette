## 2025-02-27 - Supabase PostgREST Filter Injection

**Vulnerability:** In `src/components/SearchBar.tsx`, user input is concatenated directly into a `.or()` filter string and `.ilike()` filter string in Supabase, leading to potential PostgREST filter injection and LIKE wildcard abuse. A query like `red,green` would break the `.or()` syntax since commas are used to separate terms.
**Learning:** Supabase uses PostgREST syntax for `.or()` queries, which means special characters like commas `,` are used as logical separators. Using user input directly allows an attacker to manipulate the query logic or cause server errors.
**Prevention:** Always sanitize user input when using it within Supabase `.or()` strings by removing characters like `,` and `.` (PostgREST operators) and `%`, `_`, `\` (LIKE wildcards and escapes) to prevent filter injection.

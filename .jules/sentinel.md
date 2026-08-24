## 2023-10-27 - Supabase Filter Injection via .or() Interpolation
**Vulnerability:** PostgREST filter injection and LIKE wildcard abuse (DoS risk).
**Learning:** `SearchBar.tsx` mapped user input directly into a `.or()` string (`display_name.ilike.%${word}%`). Since commas `,` are PostgREST syntax for OR conditions, an attacker could inject arbitrary filter logic. Unescaped wildcards (`%`, `_`) also exposed the database to slow LIKE queries.
**Prevention:** Sanitize string inputs that are interpolated into `.or()` strings by removing PostgREST syntax characters (like `,`) and wildcards (`%`, `_`).

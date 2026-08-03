## 2025-02-27 - Supabase PostgREST Filter Injection in Search

**Vulnerability:** Supabase queries dynamically constructed from user input (`queryBuilder.ilike('display_name', \`%\${word}%\`)` and `.or()`) didn't sanitize special characters (like `%`, `_`, `.`, `,`). This allows attackers to perform SQL LIKE wildcard abuse (causing slow queries / DoS) or PostgREST filter injection (escaping `.or()` boundaries).
**Learning:** Supabase uses PostgREST syntax under the hood. Characters like `.` and `,` have special semantic meaning in PostgREST filters (e.g. column.operator.value, and comma for OR clauses). Directly interpolating user strings into these filters without stripping or escaping these characters is a security risk.
**Prevention:** Always sanitize or escape user input before interpolating it into Supabase filter strings. At minimum, strip `%`, `_`, `.`, and `,` for simple text searches (`input.replace(/[,.%_]/g, '')`).

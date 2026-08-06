## 2024-08-06 - Prevent PostgREST filter injection in search
**Vulnerability:** The search term was interpolated directly into a Supabase `.or` query string which takes comma separated conditions.
**Learning:** PostgREST query parameters (like `or`) parse commas, dots, and percentages. When building these dynamically via string interpolation, user input can manipulate the query structure or cause a denial of service.
**Prevention:** Sanitize user input by stripping `,`, `.`, `%`, and `_` before using it in string-interpolated PostgREST filters.

## 2024-05-24 - Supabase PostgREST String Injection
**Vulnerability:** Supabase `.or()` filters using string interpolation with unescaped user input can lead to filter injection or LIKE wildcard abuse (e.g. `%`, `_`).
**Learning:** String interpolation in Supabase queries needs manual sanitization or escaping, as it skips parameterized query protections for structured operators.
**Prevention:** Always sanitize (e.g., strip or escape) untrusted strings before building PostgREST filter expressions.

## 2024-05-24 - SVG CDATA Payload Injection
**Vulnerability:** SVG vector exports carrying embedded JSON payloads in `<metadata>` CDATA blocks can prematurely close `]]>` and inject arbitrary XML/scripts (XSS).
**Learning:** JSON allows `]]>` within strings natively. CDATA only terminates on exactly `]]>`. Using a valid JSON unicode escape like `\u003e` for the angle bracket mitigates the injection while keeping the JSON valid.
**Prevention:** Escape `]]>` as `]]\u003e` whenever embedding user-controlled JSON inside a CDATA block.

## 2025-02-14 - SVG CDATA XSS via Embedded JSON
**Vulnerability:** JSON payloads embedded inside an SVG `<metadata>` block using `<![CDATA[...]]>` did not escape the `]]>` sequence in `src/lib/clipboard.ts`. A maliciously crafted JSON payload (e.g. `{"name": "]]><script>alert(1)</script>"}`) could prematurely close the CDATA block and inject executable scripts if the SVG was opened directly in a browser.
**Learning:** `JSON.stringify` does not escape `]]>`, meaning serialized user data within an XML/SVG CDATA section must be explicitly sanitized to prevent context breakouts.
**Prevention:** Always explicitly escape `]]>` (e.g., by replacing it with `\u005D\u005D\u003E`) before embedding JSON into CDATA blocks.

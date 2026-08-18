## 2026-08-18 - SVG CDATA XSS Injection in Clipboard Payload
**Vulnerability:** The JSON string embedded in the SVG `<metadata>` via CDATA could contain user-provided strings with `]]>`. This would prematurely terminate the CDATA section and allow arbitrary XML/SVG injection (XSS) if the SVG was opened directly in a browser.
**Learning:** The assumption that JSON never contains `]]>` was incorrect. User-supplied text (e.g. gradient names, tags) inside the JSON payload can be crafted to include this sequence, bridging the context between JSON and XML.
**Prevention:** When embedding JSON payloads into SVG `<metadata>` via CDATA, always ensure user-provided strings are sanitized or explicitly escape `]]>` (e.g., as `\u005D\u005D\u003E` within the JSON string) to prevent XSS vulnerabilities.

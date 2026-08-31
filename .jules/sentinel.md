## 2024-05-18 - CDATA XSS in SVG Metadata
**Vulnerability:** XSS vulnerability when embedding JSON payload containing `]]>` into SVG `<metadata>` via CDATA.
**Learning:** The application embedded JSON payloads into SVG `<metadata>` via CDATA blocks. It assumed the JSON would never contain `]]>`, which is incorrect if user-provided strings (like gradient names) are included. An attacker could craft a gradient with a name like `]]><script>alert(1)</script>`, closing the CDATA block and executing arbitrary JavaScript if the SVG is opened in a browser.
**Prevention:** Sanitize the JSON by escaping `]]>` as `\u005D\u005D\u003E` before interpolating it into the CDATA block.

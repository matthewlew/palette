## 2025-02-27 - [Fix XSS Vulnerability in SVG CDATA payload]
**Vulnerability:** A maliciously crafted gradient name (e.g. one containing `]]><script>...`) could break out of the CDATA block and execute XSS when the exported SVG is viewed in a browser.
**Learning:** The original code assumed the CDATA terminator `]]>` would never appear in a JSON payload. Since `>` only exists in strings within JSON, `]]>` could exist in the JSON.
**Prevention:** Replace `]]>` with its Unicode escape sequence `\u005D\u005D\u003E` when embedding JSON inside a `<metadata>` CDATA tag.

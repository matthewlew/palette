## 2025-02-14 - Prevent SVG CDATA XSS in Clipboard

**Vulnerability:** The application embedded user-controlled JSON configuration payloads directly inside an SVG `<metadata>` block using a `<![CDATA[...]]>` section without escaping. An attacker could set their palette name to contain `]]>` to break out of the CDATA block and inject arbitrary markup (e.g., `<script>`) into the SVG.

**Learning:** When generating XML/SVG documents that include embedded JSON data in CDATA blocks, standard JSON encoding (e.g. `JSON.stringify()`) does not prevent CDATA breakout because `]]>` is perfectly valid inside a JSON string. The JSON representation is safe, but the surrounding XML context is not.

**Prevention:** Always escape the CDATA terminator `]]>` within any user-controlled string before embedding it. For JSON payloads, a safe approach is replacing `]]>` with its unicode equivalent `\u005D\u005D\u003E`. This makes the JSON parser correctly decode the string while preventing the browser's XML parser from prematurely closing the CDATA block.

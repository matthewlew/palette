
## 2024-08-27 - SVG Metadata CDATA XSS Vulnerability
**Vulnerability:** XSS via payload injection in SVG `<metadata>` element's CDATA section, by closing the CDATA block (`]]>`) and appending malicious script tags.
**Learning:** The previous assumption that JSON never contains `]]>` was incorrect. JSON strings containing `]]>` are valid JSON, and since user input (like a gradient name) can be embedded into the JSON payload, an attacker could inject `]]>` to break out of the CDATA block and execute arbitrary scripts when the SVG is viewed directly in a browser.
**Prevention:** Always escape or sanitize data embedded in a CDATA section, especially when the data originates from or contains user input. For JSON payloads, escaping `]]>` as `\u005D\u005D\u003E` successfully neutralizes the CDATA terminator while remaining valid JSON.

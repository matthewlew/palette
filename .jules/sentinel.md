## 2024-05-18 - XSS in SVG CDATA Payload
**Vulnerability:** XSS vulnerability when opening user-crafted SVG exports containing `]]>` in the gradient name, which escapes the `<![CDATA[...]]>` payload wrapper.
**Learning:** Comments previously assumed JSON would never contain `]]>`, which is false for string values (like names).
**Prevention:** Explicitly escape `]]>` within JSON payloads as `\u005D\u005D\u003E` before placing them in a CDATA block.

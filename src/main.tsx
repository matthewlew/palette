import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// LDS, in the order the system requires: hue ramps, then core (primitives +
// semantics + components), then the theme. palette's own sheet loads last so
// it can still override.
// The explicit /lds.css subpath, not the bare 'lew-design-system' specifier:
// the bare one resolves through the exports map to a .css file, and TS has no
// declarations for that (TS2882). A path ending in .css matches vite/client's
// ambient module instead.
import 'lew-design-system/hues.css'
import 'lew-design-system/lds.css'
import 'lew-design-system/themes/palette.css'
import './index.css'
import { App } from './App.tsx'
import { installFieldZoomLock } from './lib/fieldZoomLock'

// Before render: it only binds document-level focus listeners, and a field
// focused during the first paint should already be covered.
installFieldZoomLock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

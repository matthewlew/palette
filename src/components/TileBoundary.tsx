import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Named in the console line so a bad row can be found in the table. */
  label?: string
}

interface State {
  failed: boolean
}

/**
 * Renders nothing in place of a tile that throws.
 *
 * The gallery draws whatever the shared `palettes` table holds, and several
 * things in the render path throw rather than degrade on a malformed row — a
 * single colour, an unparseable hex. Nothing rendered inside a boundary, so one
 * bad row anywhere in the feed blanked the entire app.
 *
 * `lib/paletteRow.ts` now drops rows it knows it cannot draw, which is the
 * better fix because a tile that never mounts costs nothing. This is the second
 * line: it bounds the blast radius of the throw nobody predicted to the one
 * square it came from, instead of the whole page.
 *
 * A class component because that is still the only way to catch a render error
 * in React — there is no hook equivalent.
 */
export class TileBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Loud in the console, silent on screen: a user scrolling a gallery cannot
    // act on this, and an apology box in a grid of colour is worse than a gap.
    console.error(`Gallery tile failed to render${this.props.label ? ` (${this.props.label})` : ''}:`, error, info.componentStack)
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

import { flushSync } from 'react-dom'

export function withViewTransition(update: () => void): void {
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    // React batches state updates asynchronously; the view transition must
    // capture the fully-updated DOM inside its callback or it snapshots a
    // half-applied frame and the morph stutters.
    ;(document as any).startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}

export function withViewTransition(update: () => void): void {
  if (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    ;(document as any).startViewTransition(update)
  } else {
    update()
  }
}

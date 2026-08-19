import { useEffect, useRef, useState } from 'react'
import type { ViewMode } from '../store/types'
import type { Gradient } from '../store/types'
import { buildGradientCss } from '../lib/gradient'
import { onSaveFlight, onSaveFlightArrival } from '../lib/saveFlight'
import { TurrellSquare } from './TurrellSquare'
import { useScrolling } from '../hooks/useScrolling'
import styles from './TabBar.module.css'

interface TabBarProps {
  mode: ViewMode
  onChange: (mode: 'create' | 'gallery') => void
  /** In Create the tab control obeys the idle-fade like all other chrome;
   * in Gallery it is always visible. */
  hidden?: boolean
  /** True while edit mode's desktop side panel is open: the bar centers on
   * the remaining canvas width instead of the full viewport. */
  panelOpen?: boolean
  /** True for the whole of edit mode, sheet open or dismissed. Unlike
   * `panelOpen` (which also drives the desktop centering/opacity), this only
   * controls the scroll duck below — so the bar still fades while the user
   * scrubs the rolodex with the mobile sheet dismissed, instead of sitting
   * there as the one piece of chrome that never ducks. */
  editing?: boolean
  /** Most recent saves (newest last); the Gallery tab shows them as a tiny
   * fanned stack, standing in for the removed edit-mode favorites drawer. */
  recentGradients?: Gradient[]
  savedCount?: number
}

const STACK_SIZE = 3
/** How long the bar stays forced-visible after a save flight launches: the
 * flight itself, plus a beat to see where it landed. */
const REVEAL_MS = 1600
/** Matches the .landed keyframe duration. */
const LANDED_MS = 520

function thumbStyle(gradient: Gradient): React.CSSProperties | undefined {
  return gradient.type === 'square'
    ? undefined
    : {
        backgroundImage: buildGradientCss(gradient.type, gradient.stops, gradient.reversed, {
          repeat: gradient.repeatEnabled,
          hard: gradient.hardStops,
          smooth: gradient.smoothEnabled,
          prism: gradient.prismEnabled,
          rainbow: gradient.rainbowEnabled,
          ring: gradient.ringEnabled,
          fanAnchor: gradient.fanAnchor,
          angle: gradient.angle,
        }),
      }
}

export function TabBar({
  mode,
  onChange,
  hidden = false,
  panelOpen = false,
  editing = false,
  recentGradients = [],
  savedCount = 0,
}: TabBarProps) {
  // Newest renders last (on top), slightly offset so the older saves peek
  // out behind it as a stack.
  const stack = recentGradients.slice(-STACK_SIZE)
  const scrolling = useScrolling()
  // A save can be fired from a surface where the bar is deliberately out of
  // sight — the mobile edit sheet hides it, and the create feed fades it on
  // idle. Flying a thumbnail into a target the user cannot see is worse than
  // no animation at all, so a launch forces the bar back for the duration.
  const [revealed, setRevealed] = useState(false)
  // Set at the moment of contact, not on a guessed delay: the flight layer
  // announces its own arrival.
  const [landed, setLanded] = useState(false)
  const revealTimer = useRef<number | null>(null)
  const landedTimer = useRef<number | null>(null)

  useEffect(() => {
    const stopFlight = onSaveFlight(() => {
      setRevealed(true)
      if (revealTimer.current) clearTimeout(revealTimer.current)
      revealTimer.current = window.setTimeout(() => setRevealed(false), REVEAL_MS)
    })
    const stopArrival = onSaveFlightArrival(() => {
      // Restart the keyframe on a rapid second save rather than letting the
      // first run swallow it.
      setLanded(false)
      if (landedTimer.current) clearTimeout(landedTimer.current)
      requestAnimationFrame(() => setLanded(true))
      landedTimer.current = window.setTimeout(() => setLanded(false), LANDED_MS)
    })
    return () => {
      stopFlight()
      stopArrival()
      if (revealTimer.current) clearTimeout(revealTimer.current)
      if (landedTimer.current) clearTimeout(landedTimer.current)
    }
  }, [])

  const isHidden = hidden || ((panelOpen || editing) && scrolling)
  const galleryLabel = savedCount > 0 ? `Gallery (${savedCount})` : 'Gallery'

  return (
    <nav
      data-testid="tab-bar"
      aria-label="Main"
      className={[
        styles.bar,
        isHidden && styles.hidden,
        panelOpen && styles.overCanvas,
        revealed && styles.revealed,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        data-testid="tab-gallery"
        className={mode === 'gallery' ? styles.tabOn : styles.tab}
        aria-current={mode === 'gallery' ? 'page' : undefined}
        onClick={() => onChange('gallery')}
      >
        <span className={styles.tabContent}>
          {stack.length > 0 && (
            <span
              data-testid="tab-gallery-thumb"
              className={[styles.thumbStack, landed && styles.landed].filter(Boolean).join(' ')}
            >
              {stack.map((gradient, i) => (
                <span
                  key={gradient.id}
                  className={styles.thumb}
                  style={{
                    ...thumbStyle(gradient),
                    // Older thumbs shift up-left and shrink a touch behind
                    // the newest one.
                    translate: `${(stack.length - 1 - i) * -4}px ${(stack.length - 1 - i) * -2}px`,
                    scale: String(1 - (stack.length - 1 - i) * 0.08),
                    zIndex: i,
                  }}
                >
                  {gradient.type === 'square' && (
                    <span className={styles.squareThumbInner}>
                      <TurrellSquare stops={gradient.stops} reversed={gradient.reversed} repeatEnabled={gradient.repeatEnabled} blurPx={2} angle={gradient.angle} />
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
          {/* data-text duplicated into the attribute because CSS attr() can't
              read an element's text — see .tabText, which uses it to reserve
              the bold width so selecting a tab never resizes it. */}
          <span className={styles.tabText} data-text={galleryLabel}>
            {galleryLabel}
          </span>
        </span>
      </button>
      <button
        type="button"
        data-testid="tab-create"
        className={mode === 'create' ? styles.tabOn : styles.tab}
        aria-current={mode === 'create' ? 'page' : undefined}
        onClick={() => onChange('create')}
      >
        <span className={styles.tabText} data-text="Create">
          Create
        </span>
      </button>
    </nav>
  )
}

import { useRef } from 'react'
import { buildGradientCss, type GradientType, type GradientStop } from '../lib/gradient'
import type { Gradient } from '../store/types'
import { TurrellSquare } from './TurrellSquare'
import styles from './GeometryTabs.module.css'

interface GeometryTabsProps {
  gradient: Gradient
  stops: GradientStop[]
  onSelectType: (type: GradientType) => void
  onToggleReversed: () => void
  onToggleRepeat?: () => void
  onToggleHardStops?: () => void
  onToggleSmooth?: () => void
  /** Re-tapping the active Fan tab rotates its anchor edge. */
  onRotateFan?: () => void
  onRotate?: () => void
}

const TABS: { type: GradientType; label: string }[] = [
  { type: 'linear', label: 'Linear' },
  { type: 'radial', label: 'Radial' },
  { type: 'angular', label: 'Angular' },
  { type: 'square', label: 'Turrell' },
  { type: 'mirror', label: 'Mirror' },
  { type: 'fan', label: 'Fan' },
]

// These types render their own hard-coded position sequence (mirror/legacy
// repeat) or are already solid, non-blended blocks (square/Turrell) — the
// repeat/hard filter chips are meaningless for them, so disable rather than
// silently no-op. 'repeat' is unreachable from the TABS list above (it's no
// longer user-selectable, replaced by the Repeat x2 chip) but can still
// arrive here on a gradient loaded from a pre-filter-chip save.
const FILTERS_UNSUPPORTED: GradientType[] = ['mirror', 'repeat']

export function GeometryTabs({
  gradient,
  stops,
  onSelectType,
  onToggleReversed,
  onToggleRepeat,
  onToggleHardStops,
  onToggleSmooth,
  onRotateFan,
  onRotate,
}: GeometryTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null)

  function handleWheel(e: React.WheelEvent) {
    const el = tabsRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }

  function handleTap(tabType: GradientType) {
    if (tabType === gradient.type) {
      // Re-tapping the active tab flips color order — except Fan, where it
      // rotates the cone to the next edge (bottom → top → left → right).
      if (tabType === 'fan' && onRotateFan) {
        onRotateFan()
      } else {
        onToggleReversed()
      }
    } else {
      onSelectType(tabType)
    }
  }

  // Repeat rebuilds an even position sequence, meaningless for the types that
  // author their own sequence or are already solid blocks.
  const repeatDisabled = FILTERS_UNSUPPORTED.includes(gradient.type)
  // Hard applies more broadly: angular cuts crisp wedges, and Turrell (square)
  // reads its `hard` as "no blur" (crisp nested squares). Only the types that
  // build their own hard-coded sequence can't honor it.
  const hardDisabled = gradient.type === 'mirror' || gradient.type === 'repeat'
  // Smooth densifies a continuous blend — meaningful everywhere except the
  // solid Turrell squares.
  const smoothDisabled = gradient.type === 'square'

  return (
    <div data-noscroll-hide="true" ref={tabsRef} className={styles.tabs} onWheel={handleWheel}>
      {TABS.map((tab) => (
        <button
          key={tab.type}
          type="button"
          aria-pressed={tab.type === gradient.type}
          className={tab.type === gradient.type ? styles.tabActive : styles.tab}
          onClick={() => handleTap(tab.type)}
        >
          <div className={styles.tabInner}>
            <div 
              className={styles.previewBox}
              style={{
                backgroundImage: tab.type !== 'square' ? buildGradientCss(tab.type, stops, gradient.reversed, {
                  repeat: gradient.repeatEnabled,
                  hard: gradient.hardStops,
                  fanAnchor: gradient.fanAnchor,
                  angle: gradient.angle,
                  smooth: gradient.smoothEnabled,
                }) : undefined
              }}
            >
              {tab.type === 'square' && (
                <TurrellSquare 
                  stops={stops} 
                  reversed={gradient.reversed} 
                  repeatEnabled={gradient.repeatEnabled} blurPx={gradient.hardStops ? 0 : 4} 
                  angle={gradient.angle}
                />
              )}
            </div>
            <span>{tab.label}</span>
          </div>
        </button>
      ))}
      <button
        type="button"
        data-testid="filter-repeat"
        aria-pressed={gradient.repeatEnabled}
        disabled={repeatDisabled}
        className={gradient.repeatEnabled ? styles.filterActive : styles.filter}
        onClick={onToggleRepeat}
      >
        Repeat ×2
      </button>
      <button
        type="button"
        data-testid="filter-smooth"
        aria-pressed={gradient.smoothEnabled}
        disabled={smoothDisabled}
        className={gradient.smoothEnabled ? styles.filterActive : styles.filter}
        onClick={onToggleSmooth}
      >
        Smooth
      </button>
      <button
        type="button"
        data-testid="filter-hard"
        aria-pressed={gradient.hardStops}
        disabled={hardDisabled}
        className={gradient.hardStops ? styles.filterActive : styles.filter}
        onClick={onToggleHardStops}
      >
        Hard
      </button>
      <button
        type="button"
        data-testid="filter-rotate"
        className={styles.filter}
        onClick={onRotate}
      >
        Rotate
      </button>
    </div>
  )
}

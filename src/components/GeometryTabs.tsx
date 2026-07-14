import { useRef } from 'react'
import type { GradientType } from '../lib/gradient'
import styles from './GeometryTabs.module.css'

interface GeometryTabsProps {
  type: GradientType
  onSelectType: (type: GradientType) => void
  onToggleReversed: () => void
  repeatEnabled?: boolean
  onToggleRepeat?: () => void
  hardStops?: boolean
  onToggleHardStops?: () => void
  /** Re-tapping the active Fan tab rotates its anchor edge. */
  onRotateFan?: () => void
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
const FILTERS_UNSUPPORTED: GradientType[] = ['square', 'mirror', 'repeat']

export function GeometryTabs({
  type,
  onSelectType,
  onToggleReversed,
  repeatEnabled = false,
  onToggleRepeat,
  hardStops = false,
  onToggleHardStops,
  onRotateFan,
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
    if (tabType === type) {
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

  const filtersDisabled = FILTERS_UNSUPPORTED.includes(type)

  return (
    <div ref={tabsRef} className={styles.tabs} onWheel={handleWheel}>
      {TABS.map((tab) => (
        <button
          key={tab.type}
          type="button"
          aria-pressed={tab.type === type}
          className={tab.type === type ? styles.tabActive : styles.tab}
          onClick={() => handleTap(tab.type)}
        >
          {tab.label}
        </button>
      ))}
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        data-testid="filter-repeat"
        aria-pressed={repeatEnabled}
        disabled={filtersDisabled}
        className={repeatEnabled ? styles.tabActive : styles.tab}
        onClick={onToggleRepeat}
      >
        Repeat ×2
      </button>
      <button
        type="button"
        data-testid="filter-hard"
        aria-pressed={hardStops}
        disabled={filtersDisabled}
        className={hardStops ? styles.tabActive : styles.tab}
        onClick={onToggleHardStops}
      >
        Hard
      </button>
    </div>
  )
}

import { useRef, useState } from 'react'
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
  /** Current stop order, shown on the Order chip. It sits with the other
   * modifier chips rather than in its own row under the flow editor: it is
   * a modifier like the rest, and on mobile its old row cost the sheet 91px
   * of a viewport the preview needed back. */
  orderLabel?: string
  /** The raw order key. Kept separate from orderLabel so the accessible name
   * stays exactly what it was before the chip moved. */
  order?: string
  onCycleOrder?: () => void
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

/** The sheet's two halves. Tabs on mobile, stacked headings on desktop. */
type SectionId = 'shape' | 'effect'
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'shape', label: 'Shape' },
  { id: 'effect', label: 'Effect' },
]

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
  orderLabel,
  order,
  onCycleOrder,
}: GeometryTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null)
  // Only consulted on mobile — the desktop media query shows both panels
  // regardless, so this state is inert there rather than needing a branch.
  const [section, setSection] = useState<SectionId>('shape')

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
    <div data-noscroll-hide="true" ref={tabsRef} className={styles.sections} onWheel={handleWheel}>
      {/* Mobile only. The collapsed sheet peeks ~100px, so everything below the
          shape row was behind `overflow: hidden` with no scroll and no label —
          214px of controls reachable only by finding a 36x4px grab handle.
          Naming the sections and letting you switch between them makes the
          hidden half both visible and reachable without expanding. Desktop
          renders both sections stacked instead (see the media query). */}
      <div className={styles.sectionTabs} role="tablist" aria-label="Editor sections">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`section-tab-${id}`}
            data-testid={`section-tab-${id}`}
            aria-selected={section === id}
            aria-controls={`section-panel-${id}`}
            className={section === id ? styles.sectionTabActive : styles.sectionTab}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        id="section-panel-shape"
        data-testid="section-panel-shape"
        role="tabpanel"
        aria-labelledby="section-tab-shape"
        className={section === 'shape' ? styles.panel : styles.panelInactive}
      >
        <h3 className={styles.sectionHeading}>Shape</h3>
        <div className={styles.tabs}>
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
        </div>
      </section>

      <section
        id="section-panel-effect"
        data-testid="section-panel-effect"
        role="tabpanel"
        aria-labelledby="section-tab-effect"
        className={section === 'effect' ? styles.panel : styles.panelInactive}
      >
        <h3 className={styles.sectionHeading}>Effect</h3>
        <div className={styles.filters}>
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
      {orderLabel && (
        <button
          type="button"
          data-testid="sort-button"
          aria-label={`Stop order: ${order ?? orderLabel}. Tap to change`}
          className={styles.filter}
          onClick={onCycleOrder}
        >
          Order: {orderLabel}
        </button>
      )}
        </div>
      </section>
    </div>
  )
}

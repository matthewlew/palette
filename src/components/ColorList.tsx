import { useEffect, useRef, useState } from 'react'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { Icon } from '../icons'
import type { EditableStop } from '../lib/stopOrdering'
import styles from './ColorList.module.css'

const MAX_STOPS = 8

interface ColorListProps {
  stops: EditableStop[]
  /** Indices of the pinned colors, keyed the same way the store keeps them. */
  lockedColors: Record<number, string>
  /** Indices of the pinned POSITIONS, index → 0-100 percentage. */
  lockedPositions: Record<number, number>
  onRecolor: (id: string, hex: string) => void
  onReposition: (id: string, position: number) => void
  onToggleLock: (index: number, hex: string) => void
  onTogglePositionLock: (index: number, position: number) => void
  onRemove: (id: string) => void
  onAdd: () => void
  /** The gradient as a ready-to-paste CSS declaration — the thing people
   * actually came here to copy. Built by the caller (see gradientCssSnippet)
   * so this component stays presentational. */
  cssText: string
  /** Highlights the row for the stop selected on the canvas or the flow
   * editor, so the two views stay tied together. */
  activeStopId?: string | null
  onSelect?: (id: string) => void
}

/** Accepts what people actually paste: with or without the hash, 3 or 6
 * digits, any case. Returns a canonical `#rrggbb`, or null if it isn't a
 * color yet — a partially-typed value must not be committed, or the field
 * fights the user on every keystroke. */
export function parseHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

/** Accepts a bare number or one with a trailing %, clamped to the track.
 * Returns null for anything that isn't a position yet — an empty field or a
 * lone "-" must not be committed as 0 halfway through being typed. */
export function parsePosition(input: string): number | null {
  const raw = input.trim().replace(/%$/, '').trim()
  if (!/^\d{1,3}$/.test(raw)) return null
  return Math.min(100, Math.max(0, Number(raw)))
}

function HexField({
  stop,
  onRecolor,
}: {
  stop: EditableStop
  onRecolor: (id: string, hex: string) => void
}) {
  // A local draft while focused, so typing "#f" doesn't get rejected, reset,
  // or committed as a color halfway through being entered.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? stop.hex.toUpperCase()

  function commit(next: string) {
    const parsed = parseHex(next)
    if (parsed && parsed !== stop.hex) onRecolor(stop.id, parsed)
    setDraft(null)
  }

  return (
    <input
      type="text"
      className={styles.hex}
      data-testid="color-list-hex"
      aria-label={`Hex value for stop ${stop.hex}`}
      spellCheck={false}
      autoComplete="off"
      value={value}
      onChange={(e) => {
        setDraft(e.target.value)
        // Live-apply as soon as the draft is a valid color, so dragging a hex
        // in from elsewhere updates the gradient without needing Enter.
        const parsed = parseHex(e.target.value)
        if (parsed && parsed !== stop.hex) onRecolor(stop.id, parsed)
      }}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(e.currentTarget.value)
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** The stop's percentage, editable. Same draft-while-focused contract as
 * HexField: typing "2" on the way to "25" must not commit a move to 2%. */
function PositionField({
  stop,
  onReposition,
}: {
  stop: EditableStop
  onReposition: (id: string, position: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? String(Math.round(stop.position))

  function commit(next: string) {
    const parsed = parsePosition(next)
    if (parsed !== null && parsed !== Math.round(stop.position)) onReposition(stop.id, parsed)
    setDraft(null)
  }

  return (
    <span className={styles.positionWrap}>
      <input
        type="text"
        inputMode="numeric"
        className={styles.position}
        data-testid="color-list-position"
        aria-label={`Position of stop ${stop.hex}, percent`}
        spellCheck={false}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parsePosition(e.target.value)
          if (parsed !== null) onReposition(stop.id, parsed)
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value)
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
      />
      <span className={styles.positionUnit} aria-hidden="true">
        %
      </span>
    </span>
  )
}

/**
 * The palette as a list you can read, not a row of dots you have to guess at.
 *
 * It replaces a hidden `<input type="color">` that was `.click()`ed
 * programmatically when you tapped a stop. That worked on touch, where the OS
 * picker is a sheet, but on desktop the browser anchors the picker to the
 * input's box — and the input was parked at 1x1px in the corner of the sheet,
 * so the picker opened nowhere near the color you tapped. Every row here owns
 * a REAL, visible colour input, so the picker opens on the swatch you pressed.
 *
 * The hex codes being permanently visible is the other half: this is a tool
 * for choosing colors, and you cannot choose a better one than #C2410C without
 * being told that's what you have.
 */
export function ColorList({
  stops,
  lockedColors,
  lockedPositions,
  onRecolor,
  onReposition,
  onToggleLock,
  onTogglePositionLock,
  onRemove,
  onAdd,
  cssText,
  activeStopId,
  onSelect,
}: ColorListProps) {
  const cssFeedback = useCopyFeedback()
  const hexFeedback = useCopyFeedback()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Selecting a stop on the canvas scrolls its row into view — with 8 stops
  // the desktop panel scrolls, and a selection you can't see isn't feedback.
  useEffect(() => {
    if (!activeStopId) return
    const row = listRef.current?.querySelector(`[data-stop-id="${activeStopId}"]`)
    // jsdom has no scrollIntoView, and this is pure polish — never worth a crash.
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [activeStopId])

  function copyHex(stop: EditableStop) {
    hexFeedback.copy(stop.hex.toUpperCase())
    setCopiedId(stop.id)
    window.setTimeout(() => setCopiedId((id) => (id === stop.id ? null : id)), 1500)
  }

  return (
    <div className={styles.wrap} data-testid="color-list">
      <div className={styles.header}>
        <h3 className={styles.heading}>Colors</h3>
        <button
          type="button"
          data-testid="color-list-add"
          className={styles.addButton}
          disabled={stops.length >= MAX_STOPS}
          onClick={onAdd}
        >
          + Add
        </button>
      </div>

      <ul className={styles.list} ref={listRef}>
        {stops.map((stop, index) => {
          const locked = lockedColors[index] !== undefined
          const positionLocked = lockedPositions[index] !== undefined
          return (
            <li
              key={stop.id}
              data-stop-id={stop.id}
              data-testid="color-list-row"
              className={[styles.row, stop.id === activeStopId && styles.rowActive]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={() => onSelect?.(stop.id)}
            >
              {/* A real input, sized like a swatch: the OS picker opens right
                  here rather than wherever a hidden input happened to sit.
                  The swatch alone reads as a colour preview, not a control —
                  there's no hover state on touch to suggest otherwise — so a
                  pencil badge stands in for the affordance a cursor would
                  normally carry. Pointer-events: none, so the tap still lands
                  on the input underneath. */}
              <span className={styles.swatchWrap}>
                <input
                  type="color"
                  className={styles.swatch}
                  data-testid="color-list-swatch"
                  aria-label={`Pick a color for stop ${index + 1}`}
                  value={stop.hex}
                  onChange={(e) => onRecolor(stop.id, e.target.value)}
                />
                <svg
                  className={styles.swatchBadge}
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </span>

              <HexField stop={stop} onRecolor={onRecolor} />

              <PositionField stop={stop} onReposition={onReposition} />

              {/* Two locks, because a stop is two independent facts: what
                  colour it is and where it sits. Pinning the colour and letting
                  the spacing re-flow (or the reverse — nailing a stop to 25%
                  and rolling for colours around it) are both things people
                  actually want, and one combined lock can express neither. */}
              <button
                type="button"
                data-testid="color-list-position-lock"
                className={[styles.iconButton, positionLocked && styles.iconButtonOn]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={positionLocked}
                aria-label={
                  positionLocked
                    ? `Unpin position of ${stop.hex.toUpperCase()}`
                    : `Pin position of ${stop.hex.toUpperCase()}`
                }
                title={
                  positionLocked
                    ? 'Position pinned — kept through Reset spacing and new palettes'
                    : 'Pin this position'
                }
                onClick={() => onTogglePositionLock(index, Math.round(stop.position))}
              >
                {/* Filled once the position is held — the same line/fill pair
                    every other toggle in the app uses for off/on. */}
                <Icon name={positionLocked ? 'pin-fill' : 'pin'} size="sm" />
              </button>

              <button
                type="button"
                data-testid="color-list-copy"
                className={styles.iconButton}
                aria-label={`Copy ${stop.hex.toUpperCase()}`}
                onClick={() => copyHex(stop)}
              >
                <Icon name={copiedId === stop.id ? 'check' : 'copy'} size="sm" />
              </button>

              <button
                type="button"
                data-testid="color-list-lock"
                className={[styles.iconButton, locked && styles.iconButtonOn].filter(Boolean).join(' ')}
                aria-pressed={locked}
                aria-label={locked ? `Unlock ${stop.hex.toUpperCase()}` : `Lock ${stop.hex.toUpperCase()}`}
                title={locked ? 'Locked — kept when you browse for new palettes' : 'Lock this color'}
                onClick={() => onToggleLock(index, stop.hex)}
              >
                <Icon name={locked ? 'lock' : 'lock-open'} size="sm" />
              </button>

              <button
                type="button"
                data-testid="color-list-remove"
                className={styles.iconButton}
                // Two stops are what makes it a gradient; below that there is
                // nothing to interpolate.
                disabled={stops.length <= 2}
                aria-label={`Remove ${stop.hex.toUpperCase()}`}
                onClick={() => onRemove(stop.id)}
              >
                <Icon name="close" size="sm" />
              </button>
            </li>
          )
        })}
      </ul>

      {/* A read-only textarea used to sit here so the CSS was visible as well
          as copyable. On touch, placing a finger inside ANY text field —
          read-only or not — hands the whole gesture to the browser's native
          text-selection/caret handling, which doesn't hand it back: a scroll
          that happened to start there stopped scrolling, full stop, with no
          way to continue it short of lifting off and starting over outside
          the field. A plain button has no such native gesture to steal. */}
      <button
        type="button"
        data-testid="gradient-css-copy"
        className={styles.copyCss}
        onClick={() => cssFeedback.copy(cssText)}
      >
        {cssFeedback.copied ? '✓ Copied' : 'Copy CSS'}
      </button>
    </div>
  )
}

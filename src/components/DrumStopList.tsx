import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons'
import { coverageToHex } from '../lib/riso'
import type { DrumEditableStop, Coverage } from '../lib/riso'
import styles from './DrumStopList.module.css'

const MAX_STOPS = 8

interface DrumStopListProps {
  stops: DrumEditableStop[]
  /** Ink names/hexes, parallel to each stop's `coverage` array — the
   * caller's current drum-picker selection (see DrumPicker). */
  inkNames: string[]
  inkHexes: string[]
  /** Indices of the pinned coverage vectors, keyed the same way the store
   * keeps color locks for ordinary gradients. */
  lockedCoverage: Record<number, Coverage>
  /** Indices of the pinned POSITIONS, index → 0-100 percentage. */
  lockedPositions: Record<number, number>
  onRecoverage: (id: string, inkIndex: number, percent: number) => void
  onReposition: (id: string, position: number) => void
  onToggleCoverageLock: (index: number, coverage: Coverage) => void
  onTogglePositionLock: (index: number, position: number) => void
  onRemove: (id: string) => void
  onAdd: () => void
  activeStopId?: string | null
  onSelect?: (id: string) => void
}

/** Accepts a bare number or one with a trailing %, clamped to 0-100. Returns
 * null for anything that isn't a percentage yet — same contract as
 * ColorList's parsePosition, so a half-typed value never commits mid-type. */
export function parseCoveragePercent(input: string): number | null {
  const raw = input.trim().replace(/%$/, '').trim()
  if (!/^\d{1,3}$/.test(raw)) return null
  return Math.min(100, Math.max(0, Number(raw)))
}

/** The stop's position, editable — identical contract to ColorList's
 * PositionField, duplicated rather than shared since it operates on
 * DrumEditableStop instead of EditableStop. */
function PositionField({
  stop,
  onReposition,
}: {
  stop: DrumEditableStop
  onReposition: (id: string, position: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? String(Math.round(stop.position))

  function commit(next: string) {
    const parsed = parseCoveragePercent(next)
    if (parsed !== null && parsed !== Math.round(stop.position)) onReposition(stop.id, parsed)
    setDraft(null)
  }

  return (
    <span className={styles.positionWrap}>
      <input
        type="text"
        inputMode="numeric"
        className={styles.position}
        data-testid="drum-stop-position"
        aria-label={`Position of stop, percent`}
        spellCheck={false}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parseCoveragePercent(e.target.value)
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

function CoverageField({
  stop,
  inkIndex,
  inkName,
  onRecoverage,
}: {
  stop: DrumEditableStop
  inkIndex: number
  inkName: string
  onRecoverage: (id: string, inkIndex: number, percent: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const current = Math.round(stop.coverage[inkIndex] ?? 0)
  const value = draft ?? String(current)

  function commit(next: string) {
    const parsed = parseCoveragePercent(next)
    if (parsed !== null && parsed !== current) onRecoverage(stop.id, inkIndex, parsed)
    setDraft(null)
  }

  return (
    <span className={styles.coverageWrap}>
      <input
        type="text"
        inputMode="numeric"
        className={styles.coverage}
        data-testid="drum-stop-coverage"
        aria-label={`${inkName} coverage for stop, percent`}
        spellCheck={false}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = parseCoveragePercent(e.target.value)
          if (parsed !== null) onRecoverage(stop.id, inkIndex, parsed)
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
      <span className={styles.coverageUnit} aria-hidden="true">
        %
      </span>
    </span>
  )
}

/**
 * The coverage-space analogue of ColorList (PRD §6 item 2): one row per
 * stop, one percent field per ink, with the composited swatch shown as a
 * live preview rather than the thing you edit. Ink names label the columns
 * instead of a single hex field — coverage percentages are the ground
 * truth here, hex is derived and secondary.
 *
 * The PRD's edit-panel section (§7) leaves the layout for a 3rd+ ink axis
 * as an explicitly unresolved design problem (a 2D coverage grid only draws
 * cleanly for 2 dominant inks). This sidesteps it rather than half-solving
 * it: N independent percent fields, not a grid, so it works the same at any
 * ink count.
 */
export function DrumStopList({
  stops,
  inkNames,
  inkHexes,
  lockedCoverage,
  lockedPositions,
  onRecoverage,
  onReposition,
  onToggleCoverageLock,
  onTogglePositionLock,
  onRemove,
  onAdd,
  activeStopId,
  onSelect,
}: DrumStopListProps) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!activeStopId) return
    const row = listRef.current?.querySelector(`[data-stop-id="${activeStopId}"]`)
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [activeStopId])

  return (
    <div className={styles.wrap} data-testid="drum-stop-list">
      <div className={styles.header}>
        <h3 className={styles.heading}>Stops</h3>
        <button
          type="button"
          data-testid="drum-stop-list-add"
          className={styles.addButton}
          disabled={stops.length >= MAX_STOPS}
          onClick={onAdd}
        >
          + Add
        </button>
      </div>

      <ul className={styles.list} ref={listRef}>
        {stops.map((stop, index) => {
          const coverageLocked = lockedCoverage[index] !== undefined
          const positionLocked = lockedPositions[index] !== undefined
          const hex = inkHexes.length > 0 ? coverageToHex(stop.coverage, inkHexes) : '#ffffff'
          return (
            <li
              key={stop.id}
              data-stop-id={stop.id}
              data-testid="drum-stop-row"
              className={[styles.row, stop.id === activeStopId && styles.rowActive].filter(Boolean).join(' ')}
              onPointerDown={() => onSelect?.(stop.id)}
            >
              <span
                className={styles.swatch}
                data-testid="drum-stop-swatch"
                style={{ backgroundColor: hex }}
                aria-label={`Composited color for stop ${index + 1}: ${hex}`}
              />

              <span className={styles.coverageFields}>
                {inkNames.map((inkName, inkIndex) => (
                  <span key={inkName} className={styles.coverageField}>
                    <span className={styles.inkLabel}>{inkName}</span>
                    <CoverageField stop={stop} inkIndex={inkIndex} inkName={inkName} onRecoverage={onRecoverage} />
                  </span>
                ))}
              </span>

              <PositionField stop={stop} onReposition={onReposition} />

              <button
                type="button"
                data-testid="drum-stop-position-lock"
                className={[styles.iconButton, positionLocked && styles.iconButtonOn].filter(Boolean).join(' ')}
                aria-pressed={positionLocked}
                aria-label={positionLocked ? 'Unpin position' : 'Pin position'}
                title={positionLocked ? 'Position pinned' : 'Pin this position'}
                onClick={() => onTogglePositionLock(index, Math.round(stop.position))}
              >
                <Icon name={positionLocked ? 'pin-fill' : 'pin'} size="sm" />
              </button>

              <button
                type="button"
                data-testid="drum-stop-lock"
                className={[styles.iconButton, coverageLocked && styles.iconButtonOn].filter(Boolean).join(' ')}
                aria-pressed={coverageLocked}
                aria-label={coverageLocked ? 'Unlock coverage' : 'Lock coverage'}
                title={coverageLocked ? 'Locked — kept when you browse for new palettes' : 'Lock this coverage'}
                onClick={() => onToggleCoverageLock(index, stop.coverage)}
              >
                <Icon name={coverageLocked ? 'lock' : 'lock-open'} size="sm" />
              </button>

              <button
                type="button"
                data-testid="drum-stop-remove"
                className={styles.iconButton}
                disabled={stops.length <= 2}
                aria-label={`Remove stop ${index + 1}`}
                onClick={() => onRemove(stop.id)}
              >
                <Icon name="close" size="sm" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

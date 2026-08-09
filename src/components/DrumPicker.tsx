import { INK_CATALOGUE } from '../lib/inkCatalogue'
import { Icon } from '../icons'
import styles from './DrumPicker.module.css'

interface DrumPickerProps {
  selectedNames: string[]
  onToggle: (name: string) => void
  /** Ceiling on simultaneous drum selection (a physical Riso only holds so
   * many drums at once). Once reached, unselected swatches are disabled
   * rather than hidden, so the user can still see what they'd swap in. */
  maxSelected?: number
}

/**
 * Grid of every catalogue ink, tap-to-select/deselect (PRD §6 item 1:
 * selection reads as additive — a ring + badge on the swatch, never a fade
 * of the others). Mirrors SwatchTray's swatch-grid layout; deliberately
 * drops SwatchTray's press-and-hold drag gesture, which exists there to drag
 * a color onto a specific gradient stop — drum selection has no equivalent
 * per-stop target, so the drum picker is tap-only.
 */
export function DrumPicker({ selectedNames, onToggle, maxSelected }: DrumPickerProps) {
  const selected = new Set(selectedNames)
  const atLimit = maxSelected !== undefined && selected.size >= maxSelected

  return (
    <div className={styles.grid}>
      {INK_CATALOGUE.map((ink) => {
        const isSelected = selected.has(ink.name)
        const disabled = atLimit && !isSelected
        return (
          <button
            key={ink.name}
            type="button"
            data-testid="drum-swatch"
            aria-label={ink.name}
            aria-pressed={isSelected}
            title={ink.name}
            disabled={disabled}
            className={isSelected ? styles.swatchSelected : styles.swatch}
            onClick={() => onToggle(ink.name)}
          >
            <span className={styles.swatchColor} style={{ backgroundColor: ink.hex }}>
              {isSelected && (
                <Icon name="check" size={null} className={styles.checkmark} data-testid="drum-swatch-checkmark" />
              )}
            </span>
            <span className={styles.label}>{ink.name}</span>
          </button>
        )
      })}
    </div>
  )
}

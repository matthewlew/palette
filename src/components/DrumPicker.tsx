import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'
import styles from './DrumPicker.module.css'

/** A physical Riso only holds so many drums at once — this fixes the count
 * rather than letting the list grow, matching "drums have to be swapped
 * out," not added to freely. */
export const DRUM_SLOT_COUNT = 4

interface DrumPickerProps {
  /** Exactly `slotCount` ink names, one per drum. */
  selectedNames: string[]
  onChangeSlot: (slotIndex: number, name: string) => void
  slotCount?: number
}

/**
 * Fixed drum slots, each a dropdown over the ink catalogue with a live
 * swatch preview (PRD §6 item 1). Replaces an earlier free multi-select
 * grid: a grid of every catalogue color read as "pick your colors," but a
 * Riso drum roster is a small set of physical cartridges you swap one at a
 * time — the grid didn't reflect that, and looked like a normal color
 * picker when it wasn't one.
 */
export function DrumPicker({ selectedNames, onChangeSlot, slotCount = DRUM_SLOT_COUNT }: DrumPickerProps) {
  return (
    <div className={styles.wrap} data-testid="drum-picker">
      <h3 className={styles.heading}>Drums</h3>
      <div className={styles.slots}>
        {Array.from({ length: slotCount }, (_, index) => {
          const name = selectedNames[index] ?? INK_CATALOGUE[0].name
          const hex = findInk(name)?.hex ?? '#000000'
          return (
            <label key={index} className={styles.slot} data-testid="drum-slot">
              <span className={styles.preview} aria-hidden="true" style={{ backgroundColor: hex }} />
              <select
                data-testid="drum-slot-select"
                aria-label={`Drum ${index + 1} ink`}
                className={styles.select}
                value={name}
                onChange={(e) => onChangeSlot(index, e.target.value)}
              >
                {INK_CATALOGUE.map((ink) => (
                  <option key={ink.name} value={ink.name}>
                    {ink.name}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    </div>
  )
}

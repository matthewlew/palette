import { Drawer } from '@base-ui/react/drawer'
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
  /** Controlled open state, so a parent (DrumEditMode) can close the sheet
   * from outside it — e.g. tapping the gradient preview, matching how
   * EditMode's own bottom sheet dismisses on a preview tap. Omit either prop
   * to fall back to the Drawer's own uncontrolled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Collapses to a single row of overlapping swatches — like a stack of
 * avatars — behind one button, so the mobile edit panel isn't spending
 * vertical space on drum selection and stop editing at the same time.
 * Tapping it opens the actual picker (fixed drum slots, each a dropdown
 * over the ink catalogue with a live preview) in a bottom sheet.
 *
 * The stack is deliberately not itself interactive — no per-swatch tap
 * target — because the whole point is that a drum is a hidden setting, not
 * a color you pick directly (PRD §6 item 1's open question about the grid
 * reading as "pick your colors" instead of "load a drum").
 */
export function DrumPicker({
  selectedNames,
  onChangeSlot,
  slotCount = DRUM_SLOT_COUNT,
  open,
  onOpenChange,
}: DrumPickerProps) {
  const names = Array.from({ length: slotCount }, (_, i) => selectedNames[i] ?? INK_CATALOGUE[0].name)

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Trigger
        data-testid="drum-stack-trigger"
        className={styles.stackButton}
        aria-label={`Drums: ${names.join(', ')}. Tap to edit.`}
      >
        <span className={styles.stack} aria-hidden="true">
          {names.map((name, i) => (
            <span
              key={i}
              className={styles.stackSwatch}
              style={{ backgroundColor: findInk(name)?.hex ?? '#000000', zIndex: names.length - i }}
            />
          ))}
        </span>
        <span className={styles.stackLabel}>Drums</span>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Viewport className={styles.sheetViewport}>
          <Drawer.Popup data-testid="drum-picker-sheet" className={styles.sheet}>
            <div data-testid="sheet-handle" aria-hidden="true" className={styles.sheetHandle} />
            <Drawer.Content className={styles.sheetContent}>
              <div className={styles.sheetHeader}>
                <Drawer.Title className={styles.heading}>Drums</Drawer.Title>
                <Drawer.Close className={styles.closeButton} data-testid="drum-picker-sheet-close">
                  Done
                </Drawer.Close>
              </div>
              <div className={styles.slots}>
                {names.map((name, index) => {
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
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

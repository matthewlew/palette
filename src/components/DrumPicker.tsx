import { Drawer } from '@base-ui/react/drawer'
import { Select } from '@base-ui/react/select'
import { INK_CATALOGUE, findInk } from '../lib/inkCatalogue'
import { Icon } from '../icons'
import { useIsDesktop } from '../hooks/useIsDesktop'
import styles from './DrumPicker.module.css'

/** A physical Riso only holds so many drums at once — swapping in a 5th ink
 * means swapping one of these out, not growing the list forever. */
export const MAX_DRUM_SLOTS = 4
/** Below 2 inks there's no overprint to speak of — Drum's whole premise. */
export const MIN_DRUM_SLOTS = 2
/** @deprecated kept as an alias — some call sites still default off this name. */
export const DRUM_SLOT_COUNT = MAX_DRUM_SLOTS

/** The loadout most people start with — the standard 4-color set the "Reset
 * drums" action returns to, and what a brand-new Drum gradient starts from. */
export const STANDARD_DRUM_INKS = ['Black', 'Cornflower', 'Bright Red', 'Yellow']

interface DrumPickerProps {
  /** One ink name per drum currently loaded — length IS the slot count. */
  selectedNames: string[]
  onChangeSlot: (slotIndex: number, name: string) => void
  /** Omit either to hide the add/remove controls (e.g. the standalone test
   * harness that doesn't wire a count-changing parent). */
  onAddSlot?: () => void
  onRemoveSlot?: (slotIndex: number) => void
  /** Controlled open state, so a parent (DrumEditMode) can close the sheet
   * from outside it — e.g. tapping the gradient preview, matching how
   * EditMode's own bottom sheet dismisses on a preview tap. Omit either prop
   * to fall back to the Drawer's own uncontrolled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** A swatch + name option list — replaces a plain `<select>` because a native
 * popup can't reliably show a colour per option across browsers, and seeing
 * the drum you're about to load is the point (direct user feedback: "I want
 * to be able to preview the drums"). */
function InkSelect({ value, onChange, label }: { value: string; onChange: (name: string) => void; label: string }) {
  const hex = findInk(value)?.hex ?? '#000000'
  return (
    <Select.Root
      items={INK_CATALOGUE.map((ink) => ({ value: ink.name, label: ink.name }))}
      value={value}
      onValueChange={(next) => next && onChange(next)}
    >
      <Select.Trigger data-testid="drum-slot-select" aria-label={label} className={styles.select}>
        <span className={styles.preview} aria-hidden="true" style={{ backgroundColor: hex }} />
        <Select.Value className={styles.selectValue} />
        <Select.Icon className={styles.selectIcon}>
          {/* No down-chevron in the LDS glyph set — chevron-left rotated
             reads the same and stays inside the existing icon library rather
             than adding a one-off glyph. */}
          <Icon name="chevron-left" size="sm" className={styles.selectChevron} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={styles.selectPositioner} sideOffset={4}>
          <Select.Popup className={styles.selectPopup}>
            <Select.List>
              {INK_CATALOGUE.map((ink) => (
                <Select.Item key={ink.name} value={ink.name} className={styles.selectItem} data-testid="drum-ink-option">
                  <span className={styles.optionSwatch} aria-hidden="true" style={{ backgroundColor: ink.hex }} />
                  <Select.ItemText className={styles.optionText}>{ink.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function DrumSlots({
  names,
  onChangeSlot,
  onAddSlot,
  onRemoveSlot,
}: {
  names: string[]
  onChangeSlot: (slotIndex: number, name: string) => void
  onAddSlot?: () => void
  onRemoveSlot?: (slotIndex: number) => void
}) {
  const canRemove = !!onRemoveSlot && names.length > MIN_DRUM_SLOTS
  const canAdd = !!onAddSlot && names.length < MAX_DRUM_SLOTS
  return (
    <div className={styles.slots}>
      {names.map((name, index) => (
        <div key={index} className={styles.slot} data-testid="drum-slot">
          <InkSelect value={name} onChange={(next) => onChangeSlot(index, next)} label={`Drum ${index + 1} ink`} />
          {onRemoveSlot && (
            <button
              type="button"
              data-testid="drum-slot-remove"
              aria-label={`Remove drum ${index + 1}`}
              className={styles.removeButton}
              disabled={!canRemove}
              onClick={() => onRemoveSlot(index)}
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>
      ))}
      {onAddSlot && (
        <button type="button" data-testid="drum-slot-add" className={styles.addButton} disabled={!canAdd} onClick={onAddSlot}>
          + Add drum
        </button>
      )}
    </div>
  )
}

/**
 * Collapses to a single row of overlapping swatches — like a stack of
 * avatars — behind one button, so the edit panel isn't spending vertical
 * space on drum selection and stop editing at the same time, on any layout.
 * Tapping it opens the actual picker (one dropdown per loaded drum, each
 * showing a live swatch preview, plus add/remove up to the press's drum
 * count) in a bottom sheet.
 *
 * The stack is deliberately not itself interactive — no per-swatch tap
 * target — because the whole point is that a drum is a hidden setting, not
 * a color you pick directly (PRD §6 item 1's open question about the grid
 * reading as "pick your colors" instead of "load a drum"). Most people start
 * with the standard 4-color set and never need to open this, so it should
 * stay out of the way on desktop too, not just on the space-constrained
 * mobile sheet.
 */
export function DrumPicker({
  selectedNames,
  onChangeSlot,
  onAddSlot,
  onRemoveSlot,
  open,
  onOpenChange,
}: DrumPickerProps) {
  const names = selectedNames.length > 0 ? selectedNames : [INK_CATALOGUE[0].name]
  const isDesktop = useIsDesktop()

  const trigger = (
    <span className={styles.stack} aria-hidden="true">
      {names.map((name, i) => (
        <span
          key={i}
          className={styles.stackSwatch}
          style={{ backgroundColor: findInk(name)?.hex ?? '#000000', zIndex: names.length - i }}
        />
      ))}
    </span>
  )

  // Desktop already has the side panel's own vertical space to spare, so
  // popping a whole bottom sheet over it (complete with backdrop) reads as
  // a mobile pattern borrowed wholesale rather than a real desktop control —
  // an inline disclosure that expands the panel in place fits the same
  // real estate the picker itself lives in.
  if (isDesktop) {
    return (
      <div className={styles.desktopGroup}>
        <button
          type="button"
          data-testid="drum-stack-trigger"
          className={styles.stackButton}
          aria-label={`Drums: ${names.join(', ')}. Tap to edit.`}
          aria-expanded={!!open}
          onClick={() => onOpenChange?.(!open)}
        >
          {trigger}
          <span className={styles.stackLabel}>Drums</span>
          <Icon
            name="chevron-left"
            size="sm"
            className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(' ')}
          />
        </button>
        {open && (
          <div data-testid="drum-picker-inline" className={styles.inlinePanel}>
            <DrumSlots names={names} onChangeSlot={onChangeSlot} onAddSlot={onAddSlot} onRemoveSlot={onRemoveSlot} />
          </div>
        )}
      </div>
    )
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Trigger
        data-testid="drum-stack-trigger"
        className={styles.stackButton}
        aria-label={`Drums: ${names.join(', ')}. Tap to edit.`}
        aria-expanded={!!open}
      >
        {trigger}
        <span className={styles.stackLabel}>Drums</span>
        <Icon
          name="chevron-left"
          size="sm"
          className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(' ')}
        />
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
              <DrumSlots names={names} onChangeSlot={onChangeSlot} onAddSlot={onAddSlot} onRemoveSlot={onRemoveSlot} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

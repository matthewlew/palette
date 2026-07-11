import { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { Hint } from './components/Hint'
import { Feed, riffIntoFeed } from './components/Feed'
import { Gallery } from './components/Gallery'
import { TabBar } from './components/TabBar'
import { EditMode } from './components/EditMode'
import { ShortcutHints, type ShortcutHintItem } from './components/ShortcutHints'
import { ImportBanner } from './components/ImportBanner'
import { BoardShare } from './components/BoardShare'
import { decodeFromFragment, fromImportJson, importGradient } from './lib/gradientCodec'
import { titleColorAt } from './lib/titleColor'
import { withViewTransition } from './lib/viewTransition'
import { useIdleFade } from './hooks/useIdleFade'
import type { Gradient } from './store/types'

const CREATE_SHORTCUTS: ShortcutHintItem[] = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['←', '→'], label: 'Style' },
  { keys: ['S'], label: 'Save' },
  { keys: ['E'], label: 'Edit' },
]

const EDIT_SHORTCUTS: ShortcutHintItem[] = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['←', '→'], label: 'Style' },
  { keys: ['S'], label: 'Save' },
  { keys: ['F'], label: 'Flip' },
  { keys: ['Esc'], label: 'Back' },
]

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const pendingImport = useAppStore((s) => s.pendingImport)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setMode = useAppStore((s) => s.setMode)
  const setPendingImport = useAppStore((s) => s.setPendingImport)
  const confirmImport = useAppStore((s) => s.confirmImport)
  const dismissImport = useAppStore((s) => s.dismissImport)
  const chromeVisible = useIdleFade()
  const [toastText, setToastText] = useState<string | null>(null)

  useEffect(() => {
    const payload = decodeFromFragment(window.location.hash)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map(importGradient)
    setPendingImport(gradients)
  }, [setPendingImport])

  function handleImportJson(jsonText: string) {
    const payload = fromImportJson(jsonText)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map(importGradient)
    setPendingImport(gradients)
  }

  function handleDismissImport() {
    dismissImport()
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  function handleConfirmImport() {
    const count = pendingImport?.length ?? 0
    confirmImport()
    setToastText(`Imported ${count} gradient${count === 1 ? '' : 's'} to your Gallery!`)
    setTimeout(() => {
      setToastText(null)
    }, 2500)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  function handleRiff(gradient: Gradient) {
    // Riff seeds the Create rolodex with the picked gradient (appending to
    // the persistent session) and switches surfaces in one transition.
    withViewTransition(() => {
      riffIntoFeed(gradient)
      setCurrentGradient(gradient)
      setMode('edit')
    })
  }

  return (
    <>
      {pendingImport && (
        <ImportBanner count={pendingImport.length} onConfirm={handleConfirmImport} onDismiss={handleDismissImport} />
      )}
      {mode === 'edit' && current && (
        <EditMode
          gradient={current}
          onExit={() => withViewTransition(exitEditMode)}
          onImport={handleImportJson}
        />
      )}
      {mode === 'create' && (
        <>
          <BoardShare
            saved={saved}
            current={current}
            onImport={handleImportJson}
            chromeVisible={chromeVisible}
            color={current ? titleColorAt(current, 0.94, 0.05) : undefined}
          />
          <Feed chromeVisible={chromeVisible} />
        </>
      )}
      {mode === 'gallery' && <Gallery onRiff={handleRiff} onImport={handleImportJson} />}
      {mode !== 'gallery' && (
        <ShortcutHints
          items={mode === 'edit' ? EDIT_SHORTCUTS : CREATE_SHORTCUTS}
          placement={mode === 'edit' ? 'top' : 'bottom'}
          visible={mode === 'edit' || chromeVisible}
          // Same foreground strategy as the title, sampled where the strip
          // actually sits (top-left in edit, bottom-left in create).
          color={current ? titleColorAt(current, 0.08, mode === 'edit' ? 0.12 : 0.9) : '#ffffff'}
        />
      )}
      <TabBar
        mode={mode === 'edit' ? 'create' : mode}
        hidden={mode === 'create' && !chromeVisible}
        panelOpen={mode === 'edit'}
        recentGradients={saved.slice(-3)}
        savedCount={saved.length}
        onChange={(next) => {
          if (next === mode) return
          // Exiting edit must happen inside the same view transition as the
          // mode switch — running it synchronously first re-rendered the
          // feed for a frame (the sheet vanished with a visible flash)
          // before the animated transition even started.
          withViewTransition(() => {
            if (mode === 'edit') {
              exitEditMode()
            }
            setMode(next)
          })
        }}
      />
      {toastText && <Hint text={toastText} visible={!!toastText} />}
    </>
  )
}

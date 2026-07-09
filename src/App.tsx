import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { Feed } from './components/Feed'
import { Drawer } from './components/Drawer'
import { EditMode } from './components/EditMode'
import { ImportBanner } from './components/ImportBanner'
import { BoardShare } from './components/BoardShare'
import { decodeFromFragment, fromImportJson } from './lib/gradientCodec'
import { glassToneAt } from './lib/glassTone'
import { withViewTransition } from './lib/viewTransition'
import { useIdleFade } from './hooks/useIdleFade'
import type { Gradient } from './store/types'

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const pendingImport = useAppStore((s) => s.pendingImport)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setPendingImport = useAppStore((s) => s.setPendingImport)
  const confirmImport = useAppStore((s) => s.confirmImport)
  const dismissImport = useAppStore((s) => s.dismissImport)
  const chromeVisible = useIdleFade()

  useEffect(() => {
    const payload = decodeFromFragment(window.location.hash)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map((g) => ({ ...g, id: crypto.randomUUID() }))
    setPendingImport(gradients)
  }, [setPendingImport])

  function handleImportJson(jsonText: string) {
    const payload = fromImportJson(jsonText)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map((g) => ({ ...g, id: crypto.randomUUID() }))
    setPendingImport(gradients)
  }

  function handleDismissImport() {
    dismissImport()
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  function handleConfirmImport() {
    confirmImport()
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  if (mode === 'edit' && current) {
    return <EditMode gradient={current} onExit={() => withViewTransition(exitEditMode)} />
  }

  return (
    <>
      {pendingImport && (
        <ImportBanner count={pendingImport.length} onConfirm={handleConfirmImport} onDismiss={handleDismissImport} />
      )}
      <BoardShare
        saved={saved}
        onImport={handleImportJson}
        chromeVisible={chromeVisible}
        tone={current ? glassToneAt(current, 0.94, 0.05) : 'light'}
      />
      <Feed chromeVisible={chromeVisible} />
      <Drawer
        hidden={!chromeVisible}
        saved={saved}
        onSelect={(gradient) => {
          setCurrentGradient(gradient)
        }}
      />
    </>
  )
}

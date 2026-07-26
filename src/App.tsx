import { useEffect, useRef, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { Hint } from './components/Hint'
import { Feed, riffIntoFeed } from './components/Feed'
import { Gallery } from './components/Gallery'
import { TabBar } from './components/TabBar'
import { EditMode } from './components/EditMode'
import { ShortcutHints, type ShortcutHintItem } from './components/ShortcutHints'
import { UndoToast } from './components/UndoToast'
import { BoardShare } from './components/BoardShare'
import { decodeFromFragment, fromImportJson, importGradient } from './lib/gradientCodec'
import { writeGradientToClipboard, readGradientsFromClipboard } from './lib/clipboard'
import { titleColorAt } from './lib/titleColor'
import { withViewTransition } from './lib/viewTransition'
import { useIdleFade } from './hooks/useIdleFade'
import type { Gradient } from './store/types'
import type { GradientType } from './lib/gradient'
import { supabase } from './lib/supabase'

const CREATE_SHORTCUTS: ShortcutHintItem[] = [
  { keys: ['↑', '↓'], label: 'Browse' },
  { keys: ['←', '→'], label: 'Style' },
  { keys: ['S'], label: 'Save' },
  { keys: ['E'], label: 'Edit' },
]

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const setMode = useAppStore((s) => s.setMode)
  const importGradients = useAppStore((s) => s.importGradients)
  const undoImport = useAppStore((s) => s.undoImport)
  const chromeVisible = useIdleFade()
  const [toastText, setToastText] = useState<string | null>(null)
  // Import toast carries an Undo; copy toast does not (undoable = has ids).
  const [importToast, setImportToast] = useState<{ message: string; undoable: boolean } | null>(null)
  const importToastTimer = useRef<number | null>(null)

  function showImportToast(count: number) {
    if (importToastTimer.current) clearTimeout(importToastTimer.current)
    if (count === 0) {
      setImportToast({ message: 'Already in your Gallery', undoable: false })
    } else {
      setImportToast({ message: `Added ${count} gradient${count === 1 ? '' : 's'} to Gallery`, undoable: true })
    }
    importToastTimer.current = window.setTimeout(() => setImportToast(null), 5000)
  }

  // Share-link import: decode #d=… on load, add straight to the Gallery.
  // Or if it's a slug, fetch from Supabase.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    if (hash.startsWith('#d=')) {
      const payload = decodeFromFragment(hash)
      if (!payload) return
      const gradients: Gradient[] = payload.gradients.map(importGradient)
      importGradients(gradients)
      const added = useAppStore.getState().lastImported?.ids.length ?? 0
      showImportToast(added)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    } else {
      const slug = hash.replace('#', '')
      if (!slug) return
      
      supabase
        .from('palettes')
        .select('*')
        .eq('slug', slug)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            console.error('Failed to load gradient by slug', error)
            return
          }
          // Prefer the persisted stop offsets so uneven spacing reproduces
          // exactly; fall back to even spacing for older rows saved before
          // the `offsets` column existed.
          const offsets: number[] | null = Array.isArray(data.offsets) ? data.offsets : null
          const stops = data.colors.map((hex: string, i: number) => ({
            hex,
            position: offsets?.[i] ?? (data.colors.length === 1 ? 0 : Math.round((i / (data.colors.length - 1)) * 100)),
            id: `stop-${i}`
          }))
          const gradient: Gradient = {
            id: data.id,
            name: data.display_name,
            type: data.shape as GradientType,
            stops,
            angle: data.angle ?? undefined,   // null = centred; see publishPalette
            fanAnchor: 'bottom',
            reversed: false,
            hardStops: false,
            repeatEnabled: false,
            createdAt: new Date(data.created_at).getTime()
          }
          
          // Seed the feed with this gradient and open edit mode
          withViewTransition(() => {
            riffIntoFeed(gradient)
            setCurrentGradient(gradient)
            setMode('edit')
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleImportJson(jsonText: string) {
    const payload = fromImportJson(jsonText)
    if (!payload) return
    const gradients: Gradient[] = payload.gradients.map(importGradient)
    importGradients(gradients)
    const added = useAppStore.getState().lastImported?.ids.length ?? 0
    showImportToast(added)
  }

  function handleUndoImport() {
    undoImport()
    if (importToastTimer.current) clearTimeout(importToastTimer.current)
    setImportToast(null)
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

  // App-wide Cmd/Ctrl+C copy and Cmd/Ctrl+V paste. Native clipboard events let
  // us write multiple formats synchronously and read them back on paste.
  useEffect(() => {
    function onCopy(e: ClipboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const inField = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable
      const hasSelection = (window.getSelection()?.toString().length ?? 0) > 0
      if (inField || hasSelection) return // let native copy proceed
      const state = useAppStore.getState()
      const target = state.viewerGradient ?? state.current
      if (!target) return
      writeGradientToClipboard(e, target)
      setToastText('Copied gradient')
      window.setTimeout(() => setToastText(null), 2000)
    }
    function onPaste(e: ClipboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const inField = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable
      if (inField) return // JSON import textarea keeps native paste
      const gradients = readGradientsFromClipboard(e)
      if (!gradients) return
      e.preventDefault()
      importGradients(gradients)
      const added = useAppStore.getState().lastImported?.ids.length ?? 0
      showImportToast(added)
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
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
      {/* Edit mode renders its own shortcut hints inside the panel. */}
      {mode === 'create' && (
        <ShortcutHints
          items={CREATE_SHORTCUTS}
          placement="bottom"
          visible={chromeVisible}
          // Same foreground strategy as the title, sampled where the strip sits.
          color={current ? titleColorAt(current, 0.08, 0.9) : '#ffffff'}
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
      {importToast && (
        <UndoToast
          message={importToast.message}
          onUndo={importToast.undoable ? handleUndoImport : undefined}
        />
      )}
    </>
  )
}

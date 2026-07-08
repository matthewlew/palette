import { useAppStore } from './store/useAppStore'
import { Feed } from './components/Feed'
import { Drawer } from './components/Drawer'
import { EditMode } from './components/EditMode'
import { withViewTransition } from './lib/viewTransition'
import { useIdleFade } from './hooks/useIdleFade'

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)
  const chromeVisible = useIdleFade()

  if (mode === 'edit' && current) {
    return <EditMode gradient={current} onExit={() => withViewTransition(exitEditMode)} />
  }

  return (
    <>
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

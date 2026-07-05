import { useAppStore } from './store/useAppStore'
import { Feed } from './components/Feed'
import { Drawer } from './components/Drawer'
import { EditModeStub } from './components/EditModeStub'

export function App() {
  const mode = useAppStore((s) => s.mode)
  const current = useAppStore((s) => s.current)
  const saved = useAppStore((s) => s.saved)
  const setCurrentGradient = useAppStore((s) => s.setCurrentGradient)
  const exitEditMode = useAppStore((s) => s.exitEditMode)

  if (mode === 'edit' && current) {
    return <EditModeStub gradient={current} onExit={exitEditMode} />
  }

  return (
    <>
      <Feed />
      <Drawer
        saved={saved}
        onSelect={(gradient) => {
          setCurrentGradient(gradient)
        }}
      />
    </>
  )
}

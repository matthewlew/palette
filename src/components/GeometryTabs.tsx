import type { GradientType } from '../lib/gradient'
import styles from './GeometryTabs.module.css'

interface GeometryTabsProps {
  type: GradientType
  onSelectType: (type: GradientType) => void
  onToggleReversed: () => void
}

const TABS: { type: GradientType; label: string }[] = [
  { type: 'linear', label: 'Linear' },
  { type: 'radial', label: 'Radial' },
  { type: 'angular', label: 'Angular' },
  { type: 'square', label: 'Square' },
  { type: 'mirror', label: 'Mirror' },
  { type: 'repeat', label: 'Repeat' },
]

export function GeometryTabs({ type, onSelectType, onToggleReversed }: GeometryTabsProps) {
  function handleTap(tabType: GradientType) {
    if (tabType === type) {
      onToggleReversed()
    } else {
      onSelectType(tabType)
    }
  }

  return (
    <div className={styles.tabs}>
      {TABS.map((tab) => (
        <button
          key={tab.type}
          type="button"
          aria-pressed={tab.type === type}
          className={tab.type === type ? styles.tabActive : styles.tab}
          onClick={() => handleTap(tab.type)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

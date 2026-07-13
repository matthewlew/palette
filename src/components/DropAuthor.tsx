import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { GradientType } from '../lib/gradient'
import styles from './DropAuthor.module.css'

const SHAPES: GradientType[] = ['linear', 'radial', 'angular', 'square', 'fan']

function parseColors(raw: string): string[] {
  return raw.split(',').map((c) => c.trim()).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
}

export function DropAuthor() {
  const keywordBindings = useAppStore((s) => s.keywordBindings)
  const addKeywordBinding = useAppStore((s) => s.addKeywordBinding)
  const deleteKeywordBinding = useAppStore((s) => s.deleteKeywordBinding)

  const [keyword, setKeyword] = useState('')
  const [colorsRaw, setColorsRaw] = useState('')
  const [shape, setShape] = useState<GradientType>('linear')

  function add() {
    const colors = parseColors(colorsRaw)
    if (!keyword.trim() || colors.length === 0) return
    addKeywordBinding({ keyword: keyword.trim(), colors, shape })
    setKeyword('')
    setColorsRaw('')
  }

  return (
    <div className={styles.author} data-testid="drop-author">
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Vocabulary</h3>
        <div className={styles.form}>
          <input data-testid="kw-keyword" className={styles.input} placeholder="keyword (e.g. glacier)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <input data-testid="kw-colors" className={styles.input} placeholder="#005e6b, #e3ecec" value={colorsRaw} onChange={(e) => setColorsRaw(e.target.value)} />
          <select data-testid="kw-shape" className={styles.input} value={shape} onChange={(e) => setShape(e.target.value as GradientType)}>
            {SHAPES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <button type="button" data-testid="kw-add" className={styles.btn} onClick={add}>Add</button>
        </div>
        <ul className={styles.list}>
          {keywordBindings.map((b) => (
            <li key={b.id} className={styles.item}>
              <span className={styles.itemName}>{b.keyword}</span>
              <span className={styles.swatches}>
                {b.colors.map((c, i) => (<span key={i} className={styles.swatch} style={{ background: c }} />))}
              </span>
              <button type="button" aria-label={`Delete ${b.keyword}`} className={styles.del} onClick={() => deleteKeywordBinding(b.id)}>×</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

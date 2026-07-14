import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { GradientType } from '../lib/gradient'
import { buildGradientCss } from '../lib/gradient'
import { composeGradient, scoreComposition } from '../lib/keywordCompose'
import type { KeywordBinding } from '../store/types'
import styles from './DropAuthor.module.css'

const SHAPES: GradientType[] = ['linear', 'radial', 'angular', 'square', 'fan']

function parseColors(raw: string): string[] {
  return raw.split(',').map((c) => c.trim()).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
}

export function DropAuthor() {
  const keywordBindings = useAppStore((s) => s.keywordBindings)
  const addKeywordBinding = useAppStore((s) => s.addKeywordBinding)
  const deleteKeywordBinding = useAppStore((s) => s.deleteKeywordBinding)
  const createCuratedDrop = useAppStore((s) => s.createCuratedDrop)

  const [keyword, setKeyword] = useState('')
  const [colorsRaw, setColorsRaw] = useState('')
  const [shape, setShape] = useState<GradientType>('linear')

  const [matchIds, setMatchIds] = useState<string[]>([])
  const byId = (id: string) => keywordBindings.find((b) => b.id === id)
  const matched: KeywordBinding[] = matchIds.map(byId).filter(Boolean) as KeywordBinding[]

  function addToMatch(id: string) {
    setMatchIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
  }
  function removeFromMatch(id: string) {
    setMatchIds((ids) => ids.filter((x) => x !== id))
  }
  function move(id: string, dir: 1 | -1) {
    setMatchIds((ids) => {
      const i = ids.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ids.length) return ids
      const next = [...ids]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const composedGradient = matched.length > 0 ? composeGradient(matched) : null
  const score = matched.length >= 2 ? Math.round(scoreComposition(matched)) : null

  const [dropGradients, setDropGradients] = useState<ReturnType<typeof composeGradient>[]>([])
  const [dropTitle, setDropTitle] = useState('')
  const [dropDesc, setDropDesc] = useState('')

  function addToDrop() {
    if (!composedGradient) return
    setDropGradients((g) => [...g, composedGradient])
    setMatchIds([])
  }
  function saveDrop() {
    if (dropGradients.length === 0 || !dropTitle.trim()) return
    createCuratedDrop({
      title: dropTitle.trim(),
      description: dropDesc.trim(),
      date: new Date().toISOString().slice(0, 10),
      gradients: dropGradients,
    })
    setDropGradients([])
    setDropTitle('')
    setDropDesc('')
  }

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
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Compose — match words to colors</h3>
        <div className={styles.pickRow}>
          {keywordBindings.map((b) => (
            <button key={b.id} type="button" data-testid={`match-add-${b.id}`} className={styles.pick} onClick={() => addToMatch(b.id)}>
              + {b.keyword}
            </button>
          ))}
        </div>
        <div className={styles.matchRow}>
          {matched.map((b) => (
            <div key={b.id} data-testid={`match-chip-${b.id}`} data-kw-id={b.id} className={styles.chip}>
              <button type="button" data-testid={`match-up-${b.id}`} className={styles.move} onClick={() => move(b.id, -1)} aria-label={`Move ${b.keyword} earlier`}>‹</button>
              <span className={styles.chipName}>{b.keyword}</span>
              <span className={styles.swatches}>
                {b.colors.map((c, i) => (<span key={i} className={styles.swatch} style={{ background: c }} />))}
              </span>
              <button type="button" data-testid={`match-down-${b.id}`} className={styles.move} onClick={() => move(b.id, 1)} aria-label={`Move ${b.keyword} later`}>›</button>
              <button type="button" className={styles.del} onClick={() => removeFromMatch(b.id)} aria-label={`Remove ${b.keyword}`}>×</button>
            </div>
          ))}
        </div>
        {composedGradient && (
          <div data-testid="compose-preview" className={styles.preview} style={{ backgroundImage: buildGradientCss(composedGradient.type, composedGradient.stops, false) }} />
        )}
        {score !== null && (
          <div data-testid="compose-score" className={styles.score}>Aesthetic score: {score}/100</div>
        )}
        <button type="button" data-testid="compose-add-to-drop" className={styles.btn} disabled={!composedGradient} onClick={addToDrop}>
          Add to drop
        </button>
      </section>
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Drop ({dropGradients.length})</h3>
        <div className={styles.dropStrip}>
          {dropGradients.map((g) => (
            <span key={g.id} className={styles.dropThumb} style={{ backgroundImage: buildGradientCss(g.type, g.stops, false) }} />
          ))}
        </div>
        <input data-testid="drop-title" className={styles.input} placeholder="title" value={dropTitle} onChange={(e) => setDropTitle(e.target.value)} />
        <textarea data-testid="drop-desc" className={styles.input} placeholder="short description" value={dropDesc} onChange={(e) => setDropDesc(e.target.value)} />
        <button type="button" data-testid="drop-save" className={styles.btn} disabled={dropGradients.length === 0 || !dropTitle.trim()} onClick={saveDrop}>
          Save drop
        </button>
      </section>
    </div>
  )
}

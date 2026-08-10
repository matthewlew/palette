import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrumPreflight } from './DrumPreflight'
import { checkGradientCoverage } from '../lib/drumPreflight'

describe('DrumPreflight', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(<DrumPreflight issues={[]} stopNumbers={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('collapses behind a count badge until tapped, then shows one row per issue', () => {
    const stops = [
      { id: 'a', coverage: [50, 30] },
      { id: 'b', coverage: [90, 5] },
    ]
    const issues = checkGradientCoverage(stops, ['Black', 'Cornflower'])
    render(<DrumPreflight issues={issues} stopNumbers={{ a: 1, b: 2 }} />)

    expect(screen.queryByTestId('drum-preflight-warning')).not.toBeInTheDocument()
    const toggle = screen.getByTestId('drum-preflight-toggle')
    expect(toggle).toHaveTextContent('2 notes')

    fireEvent.click(toggle)
    const rows = screen.getAllByTestId('drum-preflight-warning')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Stop 2:')
    expect(rows[0]).toHaveTextContent('Black')
    expect(rows[1]).toHaveTextContent('Stop 2:')
    expect(rows[1]).toHaveTextContent('Cornflower')
  })
})

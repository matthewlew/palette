import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrumPreflight } from './DrumPreflight'
import { checkGradientCoverage } from '../lib/drumPreflight'

describe('DrumPreflight', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(<DrumPreflight issues={[]} stopNumbers={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one warning row per issue, labeled with the stop number', () => {
    const stops = [
      { id: 'a', coverage: [50, 30] },
      { id: 'b', coverage: [90, 5] },
    ]
    const issues = checkGradientCoverage(stops, ['Black', 'Cornflower'])
    render(<DrumPreflight issues={issues} stopNumbers={{ a: 1, b: 2 }} />)
    const rows = screen.getAllByTestId('drum-preflight-warning')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Stop 2:')
    expect(rows[0]).toHaveTextContent('Black')
    expect(rows[1]).toHaveTextContent('Stop 2:')
    expect(rows[1]).toHaveTextContent('Cornflower')
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { DropAuthor } from './DropAuthor'
import { useAppStore } from '../store/useAppStore'

describe('DropAuthor vocabulary', () => {
  beforeEach(() => {
    useAppStore.setState({ keywordBindings: [], curatedDrops: [] })
  })

  it('adds a keyword binding from the form', () => {
    render(<DropAuthor />)
    fireEvent.change(screen.getByTestId('kw-keyword'), { target: { value: 'glacier' } })
    fireEvent.change(screen.getByTestId('kw-colors'), { target: { value: '#005e6b, #e3ecec' } })
    fireEvent.click(screen.getByTestId('kw-add'))
    expect(useAppStore.getState().keywordBindings).toHaveLength(1)
    expect(screen.getByText('glacier')).toBeInTheDocument()
  })
})

describe('DropAuthor compose (word-matching sort)', () => {
  beforeEach(() => {
    useAppStore.setState({
      keywordBindings: [
        { id: 'g', keyword: 'glacier', colors: ['#005e6b', '#e3ecec'] },
        { id: 'p', keyword: 'pine', colors: ['#142b1f', '#b3c4b8'] },
      ],
      curatedDrops: [],
    })
  })

  it('adds keywords to the match row and shows an aesthetic score', () => {
    render(<DropAuthor />)
    fireEvent.click(screen.getByTestId('match-add-g'))
    fireEvent.click(screen.getByTestId('match-add-p'))
    expect(screen.getByTestId('compose-score')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^match-chip-/)).toHaveLength(2)
  })

  it('reordering the match row changes the composed order', () => {
    render(<DropAuthor />)
    fireEvent.click(screen.getByTestId('match-add-g'))
    fireEvent.click(screen.getByTestId('match-add-p'))
    const before = screen.getAllByTestId(/^match-chip-/).map((c) => c.getAttribute('data-kw-id'))
    expect(before).toEqual(['g', 'p'])
    fireEvent.click(screen.getByTestId('match-down-g'))
    const after = screen.getAllByTestId(/^match-chip-/).map((c) => c.getAttribute('data-kw-id'))
    expect(after).toEqual(['p', 'g'])
  })
})

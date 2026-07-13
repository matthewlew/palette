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

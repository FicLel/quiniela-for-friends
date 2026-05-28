/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import EmptyState from '../EmptyState'

describe('EmptyState', () => {
  it('renders the "No World Cup matches" message', () => {
    render(<EmptyState />)
    expect(
      screen.getByText('No World Cup matches imported yet.')
    ).toBeInTheDocument()
  })

  it('renders the sub-line "Check back soon."', () => {
    render(<EmptyState />)
    expect(screen.getByText('Check back soon.')).toBeInTheDocument()
  })
})

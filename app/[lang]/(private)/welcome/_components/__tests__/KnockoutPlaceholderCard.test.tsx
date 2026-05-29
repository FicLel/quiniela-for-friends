/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import KnockoutPlaceholderCard from '../KnockoutPlaceholderCard'

describe('KnockoutPlaceholderCard', () => {
  it('renders the roundLabel prop', () => {
    render(<KnockoutPlaceholderCard roundLabel="Round of 16" />)
    expect(screen.getByText('Round of 16')).toBeInTheDocument()
  })

  it('renders TBD at least twice (one for each team slot)', () => {
    render(<KnockoutPlaceholderCard roundLabel="Semi-finals" />)
    const tbdElements = screen.getAllByText('TBD')
    expect(tbdElements.length).toBeGreaterThanOrEqual(2)
  })

  it('does not render any score counter buttons', () => {
    render(<KnockoutPlaceholderCard roundLabel="Final" />)
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('does not render any score inputs', () => {
    render(<KnockoutPlaceholderCard roundLabel="Final" />)
    const inputs = screen.queryAllByRole('spinbutton')
    expect(inputs).toHaveLength(0)
  })

  it('applies the rounded-xl border card style', () => {
    const { container } = render(<KnockoutPlaceholderCard roundLabel="Quarter-finals" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('rounded-xl')
    expect(card.className).toContain('border')
    expect(card.className).toContain('bg-white')
    expect(card.className).toContain('shadow-sm')
  })
})

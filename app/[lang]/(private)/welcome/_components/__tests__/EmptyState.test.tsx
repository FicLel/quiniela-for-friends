/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import EmptyState from '../EmptyState'
import enDict from '@/i18n/dictionaries/en.json'

describe('EmptyState', () => {
  it('renders the "No World Cup matches" message', () => {
    render(<EmptyState dict={enDict.welcome} />)
    expect(screen.getByText(enDict.welcome.emptyHeading)).toBeInTheDocument()
  })

  it('renders the sub-line "Check back soon."', () => {
    render(<EmptyState dict={enDict.welcome} />)
    expect(screen.getByText(enDict.welcome.emptySubtitle)).toBeInTheDocument()
  })
})

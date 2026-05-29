/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import ViewToggle from '../ViewToggle'
import enDict from '@/i18n/dictionaries/en.json'
import esDict from '@/i18n/dictionaries/es.json'

const dict = enDict.welcome

describe('ViewToggle', () => {
  it('renders a link with href="?view=date" and the viewByDate label', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const dateLink = screen.getByRole('link', { name: dict.viewByDate })
    expect(dateLink).toBeInTheDocument()
    expect(dateLink).toHaveAttribute('href', '?view=date')
  })

  it('renders a link with href="?view=group" and the viewByGroup label', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(groupLink).toBeInTheDocument()
    expect(groupLink).toHaveAttribute('href', '?view=group')
  })

  it('active date link has the active CSS class when viewMode is date', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const dateLink = screen.getByRole('link', { name: dict.viewByDate })
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(dateLink.className).toContain('bg-green-700')
    expect(groupLink.className).not.toContain('bg-green-700')
  })

  it('active group link has the active CSS class when viewMode is group', () => {
    render(<ViewToggle activeView="group" dict={dict} />)
    const dateLink = screen.getByRole('link', { name: dict.viewByDate })
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(groupLink.className).toContain('bg-green-700')
    expect(dateLink.className).not.toContain('bg-green-700')
  })

  it('inactive link has muted style (bg-gray-100)', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(groupLink.className).toContain('bg-gray-100')
  })

  // I5 — Spanish labels render correctly
  it('renders Spanish labels when dict contains Spanish values', () => {
    const esWelcome = esDict.welcome
    render(<ViewToggle activeView="date" dict={esWelcome} />)

    expect(screen.getByText(esWelcome.viewByDate)).toBeInTheDocument()
    expect(screen.getByText(esWelcome.viewByGroup)).toBeInTheDocument()
    // Confirm the actual Spanish strings appear
    expect(screen.getByText('Por Fecha')).toBeInTheDocument()
    expect(screen.getByText('Por Grupo')).toBeInTheDocument()
  })
})

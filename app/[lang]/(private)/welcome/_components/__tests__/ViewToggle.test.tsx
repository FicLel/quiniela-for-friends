/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import enDict from '@/i18n/dictionaries/en.json'
import esDict from '@/i18n/dictionaries/es.json'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSearchParamsValue: URLSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParamsValue,
}))

// Import after mock registration
import ViewToggle from '../ViewToggle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSearchParams(params: Record<string, string>) {
  mockSearchParamsValue = new URLSearchParams(params)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const dict = enDict.welcome

beforeEach(() => {
  mockSearchParamsValue = new URLSearchParams()
})

describe('ViewToggle', () => {
  it('renders a link that sets view=date and the viewByDate label', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const dateLink = screen.getByRole('link', { name: dict.viewByDate })
    expect(dateLink).toBeInTheDocument()
    expect(dateLink).toHaveAttribute('href', expect.stringContaining('view=date'))
  })

  it('renders a link that sets view=group and the viewByGroup label', () => {
    render(<ViewToggle activeView="date" dict={dict} />)
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(groupLink).toBeInTheDocument()
    expect(groupLink).toHaveAttribute('href', expect.stringContaining('view=group'))
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

  it('renders Spanish labels when dict contains Spanish values', () => {
    const esWelcome = esDict.welcome
    render(<ViewToggle activeView="date" dict={esWelcome} />)
    expect(screen.getByText(esWelcome.viewByDate)).toBeInTheDocument()
    expect(screen.getByText(esWelcome.viewByGroup)).toBeInTheDocument()
    expect(screen.getByText('Por Fecha')).toBeInTheDocument()
    expect(screen.getByText('Por Grupo')).toBeInTheDocument()
  })

  it('preserves existing quiniela param when switching to group view', () => {
    setSearchParams({ quiniela: 'abc-123', view: 'date' })
    render(<ViewToggle activeView="date" dict={dict} />)
    const groupLink = screen.getByRole('link', { name: dict.viewByGroup })
    expect(groupLink).toHaveAttribute('href', expect.stringContaining('view=group'))
    expect(groupLink).toHaveAttribute('href', expect.stringContaining('quiniela=abc-123'))
  })

  it('preserves existing quiniela param when switching to date view', () => {
    setSearchParams({ quiniela: 'abc-123', view: 'group' })
    render(<ViewToggle activeView="group" dict={dict} />)
    const dateLink = screen.getByRole('link', { name: dict.viewByDate })
    expect(dateLink).toHaveAttribute('href', expect.stringContaining('view=date'))
    expect(dateLink).toHaveAttribute('href', expect.stringContaining('quiniela=abc-123'))
  })
})

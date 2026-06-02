/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import QuinielaSwitcher from '../QuinielaSwitcher'
import enDict from '@/i18n/dictionaries/en.json'

// ---------------------------------------------------------------------------
// Mock next/navigation — the component uses useQuinielaSwitcher which depends
// on useRouter and useSearchParams.
// ---------------------------------------------------------------------------

const mockReplace = jest.fn()
let mockSearchParamsValue: URLSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParamsValue,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const QUINIELAS = [
  { id: 'q-1', name: 'World Cup 2026' },
  { id: 'q-2', name: 'Office Pool' },
]

const dict = {
  label: enDict.welcome.quinielaSwitcherLabel,
  noQuinielas: enDict.welcome.quinielaSwitcherNoQuinielas,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParamsValue = new URLSearchParams()
})

describe('QuinielaSwitcher', () => {
  it('renders the label and a select element', () => {
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-1" dict={dict} />,
    )

    expect(screen.getByText(dict.label)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders an option for each quiniela', () => {
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-1" dict={dict} />,
    )

    expect(screen.getByRole('option', { name: 'World Cup 2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Office Pool' })).toBeInTheDocument()
  })

  it('pre-selects the defaultId when no ?quiniela param is set', () => {
    mockSearchParamsValue = new URLSearchParams()
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-2" dict={dict} />,
    )

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('q-2')
  })

  it('pre-selects the ?quiniela param value when present', () => {
    mockSearchParamsValue = new URLSearchParams({ quiniela: 'q-2' })
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-1" dict={dict} />,
    )

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('q-2')
  })

  it('calls router.replace with updated param when user changes selection', () => {
    mockSearchParamsValue = new URLSearchParams()
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-1" dict={dict} />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'q-2' } })

    expect(mockReplace).toHaveBeenCalledTimes(1)
    const calledUrl = mockReplace.mock.calls[0][0] as string
    expect(calledUrl).toContain('quiniela=q-2')
  })

  it('calls onSelect callback with new id when provided', () => {
    mockSearchParamsValue = new URLSearchParams()
    const onSelect = jest.fn()
    render(
      <QuinielaSwitcher quinielas={QUINIELAS} defaultId="q-1" dict={dict} onSelect={onSelect} />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'q-2' } })

    expect(onSelect).toHaveBeenCalledWith('q-2')
  })

  it('renders the noQuinielas message when the quinielas list is empty', () => {
    render(
      <QuinielaSwitcher quinielas={[]} defaultId="" dict={dict} />,
    )

    expect(screen.getByText(dict.noQuinielas)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

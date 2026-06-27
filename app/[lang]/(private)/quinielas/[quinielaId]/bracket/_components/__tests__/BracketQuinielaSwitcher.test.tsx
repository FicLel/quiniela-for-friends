/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import BracketQuinielaSwitcher from '../BracketQuinielaSwitcher'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const QUINIELAS = [
  { id: 'q-1', name: 'World Cup 2026' },
  { id: 'q-2', name: 'Office Pool' },
]

const dict = { label: 'Viewing bracket for' }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('BracketQuinielaSwitcher', () => {
  it('renders the label and a select element', () => {
    render(<BracketQuinielaSwitcher quinielas={QUINIELAS} selectedId="q-1" lang="en" dict={dict} />)
    expect(screen.getByText(dict.label)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders an option for each quiniela', () => {
    render(<BracketQuinielaSwitcher quinielas={QUINIELAS} selectedId="q-1" lang="en" dict={dict} />)
    expect(screen.getByRole('option', { name: 'World Cup 2026' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Office Pool' })).toBeInTheDocument()
  })

  it('pre-selects the selectedId', () => {
    render(<BracketQuinielaSwitcher quinielas={QUINIELAS} selectedId="q-2" lang="en" dict={dict} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('q-2')
  })

  it('navigates to the new quinielaId bracket route on change', () => {
    render(<BracketQuinielaSwitcher quinielas={QUINIELAS} selectedId="q-1" lang="en" dict={dict} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'q-2' } })
    expect(mockPush).toHaveBeenCalledWith('/en/quinielas/q-2/bracket')
  })

  it('uses the lang prop to build the navigation path', () => {
    render(<BracketQuinielaSwitcher quinielas={QUINIELAS} selectedId="q-1" lang="es" dict={dict} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'q-2' } })
    expect(mockPush).toHaveBeenCalledWith('/es/quinielas/q-2/bracket')
  })
})

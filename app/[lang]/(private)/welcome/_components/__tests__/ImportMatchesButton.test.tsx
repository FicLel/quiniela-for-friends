/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ImportMatchesButton from '../ImportMatchesButton'
import enDict from '@/i18n/dictionaries/en.json'

jest.mock('../../actions', () => ({
  importWorldCupMatches: jest.fn(),
}))

import { importWorldCupMatches } from '../../actions'

const mockImport = importWorldCupMatches as jest.MockedFunction<typeof importWorldCupMatches>

const dict = enDict.welcome

describe('ImportMatchesButton', () => {
  beforeEach(() => {
    mockImport.mockReset()
  })

  it('does not render when userRole is "player"', () => {
    const { container } = render(<ImportMatchesButton userRole="player" dict={dict} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a button when userRole is "admin"', () => {
    render(<ImportMatchesButton userRole="admin" dict={dict} />)
    expect(
      screen.getByRole('button', { name: new RegExp(dict.importButton, 'i') }),
    ).toBeInTheDocument()
  })

  it('shows success message when action resolves { success: true, count: 3 }', async () => {
    mockImport.mockResolvedValue({ success: true, count: 3 })

    render(<ImportMatchesButton userRole="admin" dict={dict} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.importButton, 'i') }))
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        dict.importSuccess.replace('{count}', '3'),
      )
    })
  })

  it('shows success message with count 1', async () => {
    mockImport.mockResolvedValue({ success: true, count: 1 })

    render(<ImportMatchesButton userRole="admin" dict={dict} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.importButton, 'i') }))
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        dict.importSuccess.replace('{count}', '1'),
      )
    })
  })

  it('shows error message when action resolves { success: false, error: "FETCH_FAILED" }', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'FETCH_FAILED' })

    render(<ImportMatchesButton userRole="admin" dict={dict} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.importButton, 'i') }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.importErrors.FETCH_FAILED)
    })
  })

  it('shows error message when action resolves { success: false, error: "DB_ERROR" }', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'DB_ERROR' })

    render(<ImportMatchesButton userRole="admin" dict={dict} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(dict.importButton, 'i') }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(dict.importErrors.DB_ERROR)
    })
  })
})

/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ImportMatchesButton from '../ImportMatchesButton'

jest.mock('@/app/(private)/welcome/actions', () => ({
  importWorldCupMatches: jest.fn(),
}))

// Import after mock so we get the mocked version
import { importWorldCupMatches } from '@/app/(private)/welcome/actions'

const mockImport = importWorldCupMatches as jest.MockedFunction<typeof importWorldCupMatches>

describe('ImportMatchesButton', () => {
  beforeEach(() => {
    mockImport.mockReset()
  })

  it('does not render when userRole is "player"', () => {
    const { container } = render(<ImportMatchesButton userRole="player" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a button when userRole is "admin"', () => {
    render(<ImportMatchesButton userRole="admin" />)
    expect(
      screen.getByRole('button', { name: /import world cup matches/i })
    ).toBeInTheDocument()
  })

  it('shows success message when action resolves { success: true, count: 3 }', async () => {
    mockImport.mockResolvedValue({ success: true, count: 3 })

    render(<ImportMatchesButton userRole="admin" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /import world cup matches/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Imported 3 matches successfully.'
      )
    })
  })

  it('shows success message with singular "match" when count is 1', async () => {
    mockImport.mockResolvedValue({ success: true, count: 1 })

    render(<ImportMatchesButton userRole="admin" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /import world cup matches/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Imported 1 match successfully.'
      )
    })
  })

  it('shows error message when action resolves { success: false, error: "FETCH_FAILED" }', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'FETCH_FAILED' })

    render(<ImportMatchesButton userRole="admin" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /import world cup matches/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch matches from the external source. Please try again later.'
      )
    })
  })

  it('shows error message when action resolves { success: false, error: "DB_ERROR" }', async () => {
    mockImport.mockResolvedValue({ success: false, error: 'DB_ERROR' })

    render(<ImportMatchesButton userRole="admin" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /import world cup matches/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A database error occurred while saving matches. Please try again.'
      )
    })
  })
})

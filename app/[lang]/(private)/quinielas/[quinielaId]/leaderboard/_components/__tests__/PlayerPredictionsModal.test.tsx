/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from '@testing-library/react'
import PlayerPredictionsModal from '../PlayerPredictionsModal'
import type { PlayerPredictionEntry } from '@/scoring/scoring.types'

const dict = {
  title: 'Leaderboard',
  backToMembers: 'Back to members',
  noMembers: 'This quiniela has no members yet.',
  noScoresBanner: 'Scores will appear here.',
  youBadge: 'YOU',
  pts: 'pts',
  youAre: 'You are',
  colPlayer: 'Player',
  colExact: 'Exact',
  colOutcome: 'Out.',
  colPts: 'Pts',
  colExactTitle: 'Exact score hits',
  colOutcomeTitle: 'Correct outcome hits',
  colPtsTitle: 'Total points',
  pointsSystemTitle: 'How points work',
  pointsSystemClose: 'Close',
  rule1Label: '⭐ Correct outcome — 1 pt',
  rule1Desc: 'You predicted the right result.',
  rule2Label: '⚽ Correct home goals — 1 pt',
  rule2Desc: 'You predicted the exact number of home goals.',
  rule3Label: '⚽ Correct away goals — 1 pt',
  rule3Desc: 'You predicted the exact number of away goals.',
  maxPoints: 'Maximum 3 points per match.',
  colHomeGoalPts: 'H.Gls',
  colHomeGoalPtsTitle: 'Home goal points',
  colAwayGoalPts: 'A.Gls',
  colAwayGoalPtsTitle: 'Away goal points',
  colOutcomePts: 'Out.',
  colOutcomePtsTitle: 'Outcome points',
  colExtraPts: 'Extra',
  colExtraPtsTitle: 'Extra question points',
  seePredictionsButton: 'Predictions',
  predictionsModalTitle: 'Predictions for {email}',
  predictionsEmptyState: 'No finished matches to show yet.',
  predictionsLoadError: 'Could not load predictions. Please try again.',
  predictionsColMatch: 'Match',
  predictionsColPredicted: 'Predicted',
  predictionsColResult: 'Result',
  predictionsColPts: 'Pts',
  viewerLoading: 'Loading predictions…',
}

const BASE_PROPS = {
  quinielaId: 'q-1',
  userId: 'user-4',
  userEmail: 'player@example.com',
  onClose: jest.fn(),
  dict,
}

const mockPrediction: PlayerPredictionEntry = {
  matchId: 'match-1',
  homeTeamName: 'Brazil',
  awayTeamName: 'France',
  scheduledAt: '2026-06-15T15:00:00Z',
  predictedHomeScore: 2,
  predictedAwayScore: 1,
  regulationHomeGoals: 1,
  regulationAwayGoals: 1,
  homeGoalPoint: 0,
  awayGoalPoint: 1,
  outcomePoint: 0,
  totalPoints: 1,
}

function mockFetch(response: object, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  })
}

function mockFetchReject() {
  global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PlayerPredictionsModal', () => {
  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  it('renders loading state before fetch resolves', async () => {
    // fetch that never resolves
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<PlayerPredictionsModal {...BASE_PROPS} />)
    expect(screen.getByText('Loading predictions…')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Modal title
  // ---------------------------------------------------------------------------

  it('modal title contains the userEmail', async () => {
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Predictions for player@example.com',
    )
    expect(screen.getByText('Predictions for player@example.com')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Predictions data
  // ---------------------------------------------------------------------------

  it('renders prediction entries after fetch resolves with data', async () => {
    mockFetch({ predictions: [mockPrediction] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByText('Brazil vs France')).toBeInTheDocument()
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.getByText('1–1')).toBeInTheDocument()
    // totalPoints = 1
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('renders column headers when predictions are present', async () => {
    mockFetch({ predictions: [mockPrediction] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.getByText('Predicted')).toBeInTheDocument()
    expect(screen.getByText('Result')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  it('renders empty state when fetch returns { predictions: [] }', async () => {
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByText('No finished matches to show yet.')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  it('renders error message when fetch fails (non-2xx)', async () => {
    mockFetch({ success: false, error: 'UNAUTHORIZED' }, false)
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByText('Could not load predictions. Please try again.')).toBeInTheDocument()
  })

  it('renders error message when fetch rejects (network error)', async () => {
    mockFetchReject()
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(screen.getByText('Could not load predictions. Please try again.')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Close button
  // ---------------------------------------------------------------------------

  it('clicking the close button calls onClose', async () => {
    const onClose = jest.fn()
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} onClose={onClose} />)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------

  it('pressing Escape calls onClose', async () => {
    const onClose = jest.fn()
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} onClose={onClose} />)
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('pressing a non-Escape key does not call onClose', async () => {
    const onClose = jest.fn()
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} onClose={onClose} />)
    })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Backdrop click
  // ---------------------------------------------------------------------------

  it('clicking the backdrop calls onClose', async () => {
    const onClose = jest.fn()
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} onClose={onClose} />)
    })
    // The backdrop is the div with aria-hidden="true"
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Fetch called with correct URL
  // ---------------------------------------------------------------------------

  it('fetches from the correct API endpoint', async () => {
    mockFetch({ predictions: [] })
    await act(async () => {
      render(<PlayerPredictionsModal {...BASE_PROPS} />)
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/quinielas/q-1/members/user-4/predictions',
    )
  })
})

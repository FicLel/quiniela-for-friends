/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import LeaderboardClient from '../LeaderboardClient'
import type { LeaderboardRow } from '@/scoring/scoring.types'

jest.mock('../PlayerPredictionsModal', () => {
  return function MockPlayerPredictionsModal({ userId, userEmail, onClose }: { userId: string; userEmail: string; onClose: () => void }) {
    return (
      <div data-testid="predictions-modal" data-user-id={userId} data-user-email={userEmail}>
        <button onClick={onClose}>Close modal</button>
      </div>
    )
  }
})

const dict = {
  title: 'Leaderboard',
  backToMembers: 'Back to members',
  noMembers: 'This quiniela has no members yet.',
  noScoresBanner: 'Scores will appear here once matches are synced.',
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
  maxPoints: 'Maximum 3 points per match when you nail the exact score.',
  colHomeGoalPts: 'H.Gls',
  colHomeGoalPtsTitle: 'Home goal points',
  colAwayGoalPts: 'A.Gls',
  colAwayGoalPtsTitle: 'Away goal points',
  colOutcomePts: 'O.Pts',
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

const PROPS = { lang: 'en', quinielaId: 'q-1', dict }

const rows: LeaderboardRow[] = [
  {
    rank: 1,
    userId: 'user-1',
    email: 'gold@example.com',
    totalPoints: 15,
    exactScoreHits: 5,
    correctOutcomeHits: 7,
    predictedMatchCount: 10,
    homeGoalPoints: 5,
    awayGoalPoints: 5,
    outcomePoints: 4,
    extraQuestionPoints: 1,
  },
  {
    rank: 2,
    userId: 'user-2',
    email: 'silver@example.com',
    totalPoints: 12,
    exactScoreHits: 3,
    correctOutcomeHits: 6,
    predictedMatchCount: 10,
    homeGoalPoints: 4,
    awayGoalPoints: 3,
    outcomePoints: 5,
    extraQuestionPoints: 0,
  },
  {
    rank: 3,
    userId: 'user-3',
    email: 'bronze@example.com',
    totalPoints: 9,
    exactScoreHits: 2,
    correctOutcomeHits: 5,
    predictedMatchCount: 10,
    homeGoalPoints: 3,
    awayGoalPoints: 2,
    outcomePoints: 4,
    extraQuestionPoints: 0,
  },
  {
    rank: 4,
    userId: 'user-4',
    email: 'fourth@example.com',
    totalPoints: 6,
    exactScoreHits: 1,
    correctOutcomeHits: 4,
    predictedMatchCount: 8,
    homeGoalPoints: 2,
    awayGoalPoints: 1,
    outcomePoints: 3,
    extraQuestionPoints: 0,
  },
]

const zeroRows: LeaderboardRow[] = rows.map((r) => ({
  ...r,
  totalPoints: 0,
  exactScoreHits: 0,
  correctOutcomeHits: 0,
}))

describe('LeaderboardClient', () => {
  // ---------------------------------------------------------------------------
  // Email display
  // ---------------------------------------------------------------------------

  it('renders all emails', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getAllByText('gold@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('silver@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('bronze@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('fourth@example.com').length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // Mobile cards — all players
  // ---------------------------------------------------------------------------

  it('mobile cards show medal emoji for ranks 1–3', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getByRole('img', { name: 'Rank 1 medal' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 2 medal' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 3 medal' })).toBeInTheDocument()
  })

  it('mobile cards do not render a "Predictions" button', () => {
    // Mobile card section is sm:hidden — it has no Predictions buttons by design.
    // The Predictions buttons only exist in the desktop table section (inside <td> elements).
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    const buttons = screen.getAllByRole('button', { name: 'Predictions' })
    buttons.forEach((btn) => {
      expect(btn.closest('td')).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Desktop table — all players (ranks 1+)
  // ---------------------------------------------------------------------------

  it('desktop table renders all rows including rank 1–3', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    // slice(1) skips the thead <tr>
    const dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows).toHaveLength(4)
    const text = dataRows.map((r) => r.textContent).join(' ')
    expect(text).toContain('gold@example.com')
    expect(text).toContain('silver@example.com')
    expect(text).toContain('bronze@example.com')
    expect(text).toContain('fourth@example.com')
  })

  it('desktop table renders for any non-empty rows array', () => {
    const threeRows = rows.slice(0, 3)
    render(<LeaderboardClient rows={threeRows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3)
  })

  // ---------------------------------------------------------------------------
  // Caller highlighting
  // ---------------------------------------------------------------------------

  it('caller row in desktop table has bg-green-50 class', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" {...PROPS} />)
    const callerRow = document.querySelector('[aria-current="true"]')
    expect(callerRow?.className).toContain('bg-green-50')
  })

  it('YOU badge appears when caller is rank 1–3 (mobile card + desktop row)', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-1" {...PROPS} />)
    // Appears in both mobile card and desktop table row
    expect(screen.getAllByText('YOU')).toHaveLength(2)
  })

  it('YOU badge appears when caller is rank 4+ (mobile card + desktop row)', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" {...PROPS} />)
    expect(screen.getAllByText('YOU')).toHaveLength(2)
  })

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  it('shows empty state message when rows=[]', () => {
    render(<LeaderboardClient rows={[]} callerUserId="user-1" {...PROPS} />)
    expect(screen.getByText('This quiniela has no members yet.')).toBeInTheDocument()
  })

  it('does not render a list when rows=[]', () => {
    render(<LeaderboardClient rows={[]} callerUserId="user-1" {...PROPS} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // No-scores info banner
  // ---------------------------------------------------------------------------

  it('shows info banner when all points are zero', () => {
    render(<LeaderboardClient rows={zeroRows} callerUserId="user-99" {...PROPS} />)
    expect(
      screen.getByText(/Scores will appear here once matches are synced/),
    ).toBeInTheDocument()
  })

  it('does not show info banner when scores exist', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.queryByText(/Scores will appear here/)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Sticky footer
  // ---------------------------------------------------------------------------

  it('shows sticky footer with rank when caller is rank 4+', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" {...PROPS} />)
    // #4 appears in both the mobile card and the sticky footer
    expect(screen.getAllByText('#4').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('You are')).toBeInTheDocument()
  })

  it('does not show sticky footer when caller is rank 1–3', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-1" {...PROPS} />)
    expect(screen.queryByText(/You are #/)).not.toBeInTheDocument()
  })

  it('does not show sticky footer when caller is not in rows', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.queryByText(/You are #/)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Points system panel
  // ---------------------------------------------------------------------------

  it('? button is visible', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getByRole('button', { name: 'How points work' })).toBeInTheDocument()
  })

  it('points panel is hidden by default', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.queryByText('How points work')).not.toBeInTheDocument()
  })

  it('clicking ? shows the points panel', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'How points work' }))
    expect(screen.getByText('How points work')).toBeInTheDocument()
    expect(screen.getByText('⭐ Correct outcome — 1 pt')).toBeInTheDocument()
    expect(screen.getByText('⚽ Correct home goals — 1 pt')).toBeInTheDocument()
    expect(screen.getByText('⚽ Correct away goals — 1 pt')).toBeInTheDocument()
    expect(screen.getByText(/Maximum 3 points/)).toBeInTheDocument()
  })

  it('clicking Close hides the points panel', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'How points work' }))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByText('How points work')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Back link
  // ---------------------------------------------------------------------------

  it('back link points to the members page', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    const link = screen.getByText('Back to members').closest('a')
    expect(link).toHaveAttribute('href', '/en/quinielas/q-1/members')
  })

  // ---------------------------------------------------------------------------
  // Points display
  // ---------------------------------------------------------------------------

  it('shows total points for each row', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------------------
  // i18n — title uses dict
  // ---------------------------------------------------------------------------

  it('renders the translated title', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Breakdown column headers (desktop table)
  // ---------------------------------------------------------------------------

  it('renders all breakdown column headers', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getByTitle('Home goal points')).toBeInTheDocument()
    expect(screen.getByTitle('Away goal points')).toBeInTheDocument()
    expect(screen.getByTitle('Outcome points')).toBeInTheDocument()
    expect(screen.getByTitle('Extra question points')).toBeInTheDocument()
    expect(screen.getByTitle('Total points')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Breakdown column values (desktop table rows)
  // ---------------------------------------------------------------------------

  it('desktop table rows render all four breakdown point values', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    const dataRows = screen.getAllByRole('row').slice(1)
    const fourthRow = dataRows.find((r) => r.textContent?.includes('fourth@example.com'))
    // user-4: homeGoalPoints=2, awayGoalPoints=1, outcomePoints=3, extraQuestionPoints=0
    expect(fourthRow?.textContent).toContain('2')
    expect(fourthRow?.textContent).toContain('1')
    expect(fourthRow?.textContent).toContain('3')
  })

  // ---------------------------------------------------------------------------
  // See Predictions button (desktop table only)
  // ---------------------------------------------------------------------------

  it('"Predictions" button is present for every row in the desktop table', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    // 4 rows in the table → 4 Predictions buttons
    expect(screen.getAllByRole('button', { name: 'Predictions' })).toHaveLength(4)
  })

  it('clicking the first "Predictions" button opens the modal for rank-1 player', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.queryByTestId('predictions-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Predictions' })[0])
    const modal = screen.getByTestId('predictions-modal')
    expect(modal).toBeInTheDocument()
    expect(modal).toHaveAttribute('data-user-id', 'user-1')
    expect(modal).toHaveAttribute('data-user-email', 'gold@example.com')
  })

  it('closing the modal hides PlayerPredictionsModal', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Predictions' })[0])
    expect(screen.getByTestId('predictions-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Close modal'))
    expect(screen.queryByTestId('predictions-modal')).not.toBeInTheDocument()
  })
})

/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import LeaderboardClient from '../LeaderboardClient'
import type { LeaderboardRow } from '@/scoring/scoring.types'

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
  },
  {
    rank: 2,
    userId: 'user-2',
    email: 'silver@example.com',
    totalPoints: 12,
    exactScoreHits: 3,
    correctOutcomeHits: 6,
    predictedMatchCount: 10,
  },
  {
    rank: 3,
    userId: 'user-3',
    email: 'bronze@example.com',
    totalPoints: 9,
    exactScoreHits: 2,
    correctOutcomeHits: 5,
    predictedMatchCount: 10,
  },
  {
    rank: 4,
    userId: 'user-4',
    email: 'fourth@example.com',
    totalPoints: 6,
    exactScoreHits: 1,
    correctOutcomeHits: 4,
    predictedMatchCount: 8,
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
    expect(screen.getByText('gold@example.com')).toBeInTheDocument()
    expect(screen.getByText('silver@example.com')).toBeInTheDocument()
    expect(screen.getByText('bronze@example.com')).toBeInTheDocument()
    expect(screen.getByText('fourth@example.com')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Podium (top 3)
  // ---------------------------------------------------------------------------

  it('podium shows medal emoji for each top-3 rank', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    expect(screen.getByRole('img', { name: 'Rank 1 medal' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 2 medal' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Rank 3 medal' })).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Ranked list (rank 4+)
  // ---------------------------------------------------------------------------

  it('ranked list contains only rank-4+ rows as list items', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" {...PROPS} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('fourth@example.com')
  })

  it('ranked list is absent when all rows are in the podium', () => {
    const threeRows = rows.slice(0, 3)
    render(<LeaderboardClient rows={threeRows} callerUserId="user-99" {...PROPS} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Caller highlighting
  // ---------------------------------------------------------------------------

  it('caller row in ranked list has bg-green-50 class', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" {...PROPS} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toContain('bg-green-50')
  })

  it('YOU badge appears when caller is in the podium', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-1" {...PROPS} />)
    expect(screen.getByText('YOU')).toBeInTheDocument()
  })

  it('YOU badge appears when caller is in the ranked list', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" {...PROPS} />)
    expect(screen.getByText('YOU')).toBeInTheDocument()
  })

  it('only one YOU badge renders per render', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-2" {...PROPS} />)
    expect(screen.getAllByText('YOU')).toHaveLength(1)
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
    expect(screen.getByText('#4')).toBeInTheDocument()
  })

  it('does not show sticky footer when caller is in the podium', () => {
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
})

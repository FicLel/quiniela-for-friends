/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import LeaderboardClient from '../LeaderboardClient'
import type { LeaderboardRow } from '@/scoring/scoring.types'

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

describe('LeaderboardClient', () => {
  // -------------------------------------------------------------------------
  // Renders all rows
  // -------------------------------------------------------------------------

  it('renders all rows sorted by rank', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    // First item contains rank 1st and highest-points email
    expect(items[0].textContent).toContain('1st')
    expect(items[0].textContent).toContain('gold@example.com')
    expect(items[3].textContent).toContain('fourth@example.com')
  })

  // -------------------------------------------------------------------------
  // Top 3 medal styling
  // -------------------------------------------------------------------------

  it('top 3 rows have gold/silver/bronze ring styling', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toContain('ring-yellow-400')
    expect(items[1].className).toContain('ring-gray-400')
    expect(items[2].className).toContain('ring-amber-600')
  })

  it('4th row does not have medal ring styling', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" />)
    const items = screen.getAllByRole('listitem')
    expect(items[3].className).not.toContain('ring-yellow-400')
    expect(items[3].className).not.toContain('ring-gray-400')
    expect(items[3].className).not.toContain('ring-amber-600')
  })

  // -------------------------------------------------------------------------
  // Caller's row highlight
  // -------------------------------------------------------------------------

  it("caller's row has highlighted background", () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-4" />)
    const items = screen.getAllByRole('listitem')
    // user-4 is rank 4 (index 3)
    expect(items[3].className).toContain('bg-green-50')
  })

  it("caller's row shows (you) label", () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-2" />)
    expect(screen.getByText('(you)')).toBeInTheDocument()
  })

  it("caller's own row does not show (you) label on other rows", () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-1" />)
    const youLabels = screen.getAllByText('(you)')
    expect(youLabels).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when rows=[]', () => {
    render(<LeaderboardClient rows={[]} callerUserId="user-1" />)
    expect(screen.getByText('No predictions have been scored yet.')).toBeInTheDocument()
  })

  it('does not render a list when rows=[]', () => {
    render(<LeaderboardClient rows={[]} callerUserId="user-1" />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Points and email display
  // -------------------------------------------------------------------------

  it('shows correct totalPoints for each row', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" />)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('shows correct email for each row', () => {
    render(<LeaderboardClient rows={rows} callerUserId="user-99" />)
    expect(screen.getByText('gold@example.com')).toBeInTheDocument()
    expect(screen.getByText('silver@example.com')).toBeInTheDocument()
    expect(screen.getByText('bronze@example.com')).toBeInTheDocument()
    expect(screen.getByText('fourth@example.com')).toBeInTheDocument()
  })
})

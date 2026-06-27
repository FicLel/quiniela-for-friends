/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import BracketMatchupCard from '../BracketMatchupCard'
import enDict from '@/i18n/dictionaries/en.json'
import type { MatchupCard } from '@/tournaments/tournaments.types'

const dict = enDict.bracket

function makeMatchup(overrides: Partial<MatchupCard> = {}): MatchupCard {
  return {
    matchId: 'match-1',
    bracketSlot: 'R32-1',
    stage: 'ROUND_OF_32',
    matchupDescription: 'Group A Winner vs Group B Runner-up',
    homeTeamName: 'TBD',
    awayTeamName: 'TBD',
    teamsResolved: false,
    status: 'SCHEDULED',
    scheduledAt: '2026-06-28T18:00:00.000Z',
    prediction: null,
    result: null,
    ...overrides,
  }
}

describe('BracketMatchupCard', () => {
  // ---------------------------------------------------------------------------
  // Unplayed, no prediction
  // ---------------------------------------------------------------------------

  it('shows the no-prediction empty state when unplayed and no prediction exists', () => {
    render(<BracketMatchupCard matchup={makeMatchup()} dict={dict} lang="en" />)
    expect(screen.getByText(dict.noPrediction)).toBeInTheDocument()
  })

  it('shows the unplayed status badge when there is no result', () => {
    render(<BracketMatchupCard matchup={makeMatchup()} dict={dict} lang="en" />)
    expect(screen.getByText(dict.statusUnplayed)).toBeInTheDocument()
    expect(screen.queryByText(dict.statusPlayed)).not.toBeInTheDocument()
  })

  it('does not show a result row when unplayed', () => {
    render(<BracketMatchupCard matchup={makeMatchup()} dict={dict} lang="en" />)
    expect(screen.queryByText(dict.resultLabel)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Unplayed, with prediction — shows matchup description + prediction
  // ---------------------------------------------------------------------------

  it('shows the matchup description when teams are unresolved', () => {
    render(<BracketMatchupCard matchup={makeMatchup()} dict={dict} lang="en" />)
    expect(screen.getByText('Group A Winner vs Group B Runner-up')).toBeInTheDocument()
  })

  it('shows the prediction score when unplayed but a prediction exists', () => {
    const matchup = makeMatchup({ prediction: { homeScore: 2, awayScore: 1 } })
    render(<BracketMatchupCard matchup={matchup} dict={dict} lang="en" />)
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.queryByText(dict.noPrediction)).not.toBeInTheDocument()
  })

  it('does not show the matchup description once teams are resolved', () => {
    const matchup = makeMatchup({
      teamsResolved: true,
      homeTeamName: 'Brazil',
      awayTeamName: 'Argentina',
    })
    render(<BracketMatchupCard matchup={matchup} dict={dict} lang="en" />)
    expect(screen.queryByText('Group A Winner vs Group B Runner-up')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Played match — shows both prediction and result, stacked
  // ---------------------------------------------------------------------------

  it('shows both the prediction and the result for a played match', () => {
    const matchup = makeMatchup({
      teamsResolved: true,
      homeTeamName: 'Brazil',
      awayTeamName: 'Argentina',
      status: 'FINISHED',
      prediction: { homeScore: 1, awayScore: 1 },
      result: { homeGoals: 2, awayGoals: 1 },
    })
    render(<BracketMatchupCard matchup={matchup} dict={dict} lang="en" />)
    expect(screen.getByText('1–1')).toBeInTheDocument()
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.getByText(dict.statusPlayed)).toBeInTheDocument()
  })

  it('shows the played result even when the member submitted no prediction', () => {
    const matchup = makeMatchup({
      teamsResolved: true,
      homeTeamName: 'Brazil',
      awayTeamName: 'Argentina',
      result: { homeGoals: 3, awayGoals: 0 },
    })
    render(<BracketMatchupCard matchup={matchup} dict={dict} lang="en" />)
    expect(screen.getByText('3–0')).toBeInTheDocument()
    expect(screen.getByText(dict.noPrediction)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Team names — long names must not break layout (rendered, truncate class applied)
  // ---------------------------------------------------------------------------

  it('renders long team names with a truncate class to avoid overflow', () => {
    const matchup = makeMatchup({
      teamsResolved: true,
      homeTeamName: 'A Very Long National Team Name That Could Overflow',
      awayTeamName: 'Another Extremely Long Team Name',
    })
    render(<BracketMatchupCard matchup={matchup} dict={dict} lang="en" />)
    const homeEl = screen.getByText('A Very Long National Team Name That Could Overflow')
    expect(homeEl.className).toContain('truncate')
  })
})

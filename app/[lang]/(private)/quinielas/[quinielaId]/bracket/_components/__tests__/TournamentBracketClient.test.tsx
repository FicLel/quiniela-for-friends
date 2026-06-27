/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import TournamentBracketClient from '../TournamentBracketClient'
import enDict from '@/i18n/dictionaries/en.json'
import type { BracketView, GetBracketResult, MatchupCard } from '@/tournaments/tournaments.types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

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

function makeBracket(overrides: Partial<BracketView> = {}): BracketView {
  return {
    quinielaId: 'q-1',
    stages: [
      {
        stage: 'ROUND_OF_32',
        matchups: [makeMatchup({ matchId: 'r32-1' })],
      },
      {
        stage: 'FINAL',
        matchups: [makeMatchup({ matchId: 'final-1', stage: 'FINAL' })],
      },
      {
        stage: 'THIRD_PLACE',
        matchups: [makeMatchup({ matchId: 'third-1', stage: 'THIRD_PLACE' })],
      },
    ],
    ...overrides,
  }
}

const QUINIELAS = [
  { id: 'q-1', name: 'World Cup 2026' },
  { id: 'q-2', name: 'Office Pool' },
]

beforeEach(() => {
  jest.clearAllMocks()
})

describe('TournamentBracketClient', () => {
  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  it('shows the error state when the result is FETCH_FAILED', () => {
    const result: GetBracketResult = { success: false, error: 'FETCH_FAILED' }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByText(dict.errorState)).toBeInTheDocument()
  })

  it('shows the error state when the result is UNKNOWN_ERROR', () => {
    const result: GetBracketResult = { success: false, error: 'UNKNOWN_ERROR' }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByText(dict.errorState)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Empty bracket
  // ---------------------------------------------------------------------------

  it('shows the not-yet-available empty state when there are no stages', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket({ stages: [] }) }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByText(dict.notYetAvailable)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Success — desktop round navigation (role="tab")
  // ---------------------------------------------------------------------------

  it('renders round tabs for each main stage present in the bracket', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByRole('tab', { name: dict.stageRoundOf32 })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: dict.stageFinal })).toBeInTheDocument()
  })

  it('defaults to the last available main stage (Final) as the active tab', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByRole('tab', { name: dict.stageFinal })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches the visible round when a different tab is clicked', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: dict.stageRoundOf32 }))
    expect(screen.getByRole('tab', { name: dict.stageRoundOf32 })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: dict.stageFinal })).toHaveAttribute('aria-selected', 'false')
  })

  it('does not render a tab for the THIRD_PLACE stage', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.queryByRole('tab', { name: dict.stageThirdPlace })).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Mobile prev/next navigator
  // ---------------------------------------------------------------------------

  it('renders the mobile prev/next buttons', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeInTheDocument()
  })

  it('disables the Previous button when the first stage is active', () => {
    const bracket = makeBracket({
      stages: [{ stage: 'ROUND_OF_32', matchups: [makeMatchup({ matchId: 'r32-1' })] }],
    })
    const result: GetBracketResult = { success: true, bracket }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByRole('button', { name: 'Previous stage' })).toBeDisabled()
  })

  it('disables the Next button when the last stage (Final) is active', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    // Default active stage is the last one (Final)
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled()
  })

  it('navigates to the previous stage when the Previous button is clicked', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    // Start at Final; go back to Round of 32
    fireEvent.click(screen.getByRole('button', { name: 'Previous stage' }))
    expect(screen.getByRole('tab', { name: dict.stageRoundOf32 })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: dict.stageFinal })).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates to the next stage when the Next button is clicked', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    // Go back to Round of 32 first, then forward again
    fireEvent.click(screen.getByRole('button', { name: 'Previous stage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next stage' }))
    expect(screen.getByRole('tab', { name: dict.stageFinal })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the current stage label and position in the mobile navigator', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    // Default is Final — label appears in both desktop tab and mobile navigator span
    expect(screen.getAllByText(dict.stageFinal).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Third-place branch — visible near the Final, not a dead-end / not omitted
  // ---------------------------------------------------------------------------

  it('shows the third-place branch when the Final tab is active', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    // Final is the default active tab
    expect(screen.getAllByText(dict.stageThirdPlace).length).toBeGreaterThan(0)
  })

  it('hides the third-place branch when a non-Final tab is active', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: dict.stageRoundOf32 }))
    expect(screen.queryByText(dict.stageThirdPlace)).not.toBeInTheDocument()
  })

  it('does not render the third-place branch when no THIRD_PLACE stage exists', () => {
    const bracket = makeBracket({
      stages: [{ stage: 'FINAL', matchups: [makeMatchup({ matchId: 'final-1', stage: 'FINAL' })] }],
    })
    const result: GetBracketResult = { success: true, bracket }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.queryByText(dict.stageThirdPlace)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Quiniela switcher gating
  // ---------------------------------------------------------------------------

  it('shows the quiniela switcher when the user belongs to more than one quiniela', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={QUINIELAS} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('hides the quiniela switcher when the user belongs to only one quiniela', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient
        result={result}
        quinielas={[QUINIELAS[0]]}
        quinielaId="q-1"
        lang="en"
        dict={dict}
      />,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('hides the quiniela switcher when the user belongs to zero quinielas', () => {
    const result: GetBracketResult = { success: true, bracket: makeBracket() }
    render(
      <TournamentBracketClient result={result} quinielas={[]} quinielaId="q-1" lang="en" dict={dict} />,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

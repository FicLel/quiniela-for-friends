/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import KnockoutSection from '../KnockoutSection'
import type { MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'

const dict = enDict.welcome

const makeMatch = (id: string, stage: string): MatchCardData => ({
  id,
  homeTeamName: 'Team A',
  homeTeamShortName: 'TMA',
  homeTeamTla: 'TMA',
  homeTeamCrest: null,
  awayTeamName: 'Team B',
  awayTeamShortName: 'TMB',
  awayTeamTla: 'TMB',
  awayTeamCrest: null,
  scheduledAt: '2026-07-01T18:00:00Z',
  status: 'SCHEDULED',
  stage,
})

describe('KnockoutSection', () => {
  it('renders 4 placeholder cards when knockoutMatches is empty', () => {
    render(<KnockoutSection knockoutMatches={[]} dict={dict} lang="en" />)

    // Each round label appears in both the section heading and the placeholder card
    expect(screen.getAllByText(dict.knockoutRoundOf16).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(dict.knockoutQuarterFinals).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(dict.knockoutSemiFinals).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(dict.knockoutFinal).length).toBeGreaterThanOrEqual(1)

    // All 4 rounds show TBD (each placeholder has 2 TBDs = 8 total)
    const tbdElements = screen.getAllByText('TBD')
    expect(tbdElements.length).toBeGreaterThanOrEqual(4)
  })

  it('renders a MatchCard for a SEMI_FINALS match and placeholders for other 3 rounds', () => {
    const semiMatch = makeMatch('semi-1', 'SEMI_FINALS')
    render(<KnockoutSection knockoutMatches={[semiMatch]} dict={dict} lang="en" />)

    // Semi-finals: renders a real match card — team names visible
    expect(screen.getAllByText('Team A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team B').length).toBeGreaterThanOrEqual(1)

    // Other rounds still show TBD
    // There should still be TBD entries (from the 3 remaining placeholder rounds)
    const tbdElements = screen.getAllByText('TBD')
    expect(tbdElements.length).toBeGreaterThanOrEqual(3)
  })

  it('renders rounds in fixed order: ROUND_OF_16 → QUARTER_FINALS → SEMI_FINALS → FINAL', () => {
    render(<KnockoutSection knockoutMatches={[]} dict={dict} lang="en" />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    const labels = headings.map((h) => h.textContent)

    expect(labels[0]).toBe(dict.knockoutRoundOf16)
    expect(labels[1]).toBe(dict.knockoutQuarterFinals)
    expect(labels[2]).toBe(dict.knockoutSemiFinals)
    expect(labels[3]).toBe(dict.knockoutFinal)
  })

  it('renders section headings for all rounds regardless of data', () => {
    const finalMatch = makeMatch('final-1', 'FINAL')
    render(<KnockoutSection knockoutMatches={[finalMatch]} dict={dict} lang="en" />)

    expect(screen.getByRole('heading', { name: dict.knockoutRoundOf16 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutQuarterFinals })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutSemiFinals })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutFinal })).toBeInTheDocument()
  })

  // I3 — empty group-stage context does not affect KnockoutSection rendering
  it('renders correctly when groupStageMatches is empty and knockoutMatches has data', () => {
    const semiMatch = makeMatch('semi-edge', 'SEMI_FINALS')
    // KnockoutSection only receives knockoutMatches — groupStageMatches context is irrelevant
    render(<KnockoutSection knockoutMatches={[semiMatch]} dict={dict} lang="en" />)

    // Should not crash; real MatchCard for SEMI_FINALS renders team names
    expect(screen.getAllByText('Team A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team B').length).toBeGreaterThanOrEqual(1)
    // All four round headings still present
    expect(screen.getByRole('heading', { name: dict.knockoutRoundOf16 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutQuarterFinals })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutSemiFinals })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: dict.knockoutFinal })).toBeInTheDocument()
  })

  // I6 — ROUND_OF_16 real match path
  it('renders a MatchCard for a ROUND_OF_16 match and placeholders for other 3 rounds', () => {
    const r16Match = makeMatch('r16-1', 'ROUND_OF_16')
    render(<KnockoutSection knockoutMatches={[r16Match]} dict={dict} lang="en" />)

    // ROUND_OF_16 renders real team names
    expect(screen.getAllByText('Team A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team B').length).toBeGreaterThanOrEqual(1)

    // Other 3 rounds still show TBD placeholders
    const tbdElements = screen.getAllByText('TBD')
    expect(tbdElements.length).toBeGreaterThanOrEqual(3)
  })

  // I6 — QUARTER_FINALS real match path
  it('renders a MatchCard for a QUARTER_FINALS match and placeholders for other 3 rounds', () => {
    const qfMatch = makeMatch('qf-1', 'QUARTER_FINALS')
    render(<KnockoutSection knockoutMatches={[qfMatch]} dict={dict} lang="en" />)

    // QUARTER_FINALS renders real team names
    expect(screen.getAllByText('Team A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team B').length).toBeGreaterThanOrEqual(1)

    // Other 3 rounds still show TBD placeholders
    const tbdElements = screen.getAllByText('TBD')
    expect(tbdElements.length).toBeGreaterThanOrEqual(3)
  })
})

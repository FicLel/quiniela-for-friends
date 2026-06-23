/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import DateGroupedView from '../DateGroupedView'
import type { MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'

const dict = enDict.welcome

// Use UTC midnight times so toLocalDateKey produces predictable results
// regardless of the test runner's timezone.
const matchA: MatchCardData = {
  id: 'match-a',
  homeTeamName: 'Germany',
  homeTeamShortName: 'GER',
  homeTeamTla: 'GER',
  homeTeamCrest: null,
  awayTeamName: 'Brazil',
  awayTeamShortName: 'BRA',
  awayTeamTla: 'BRA',
  awayTeamCrest: null,
  scheduledAt: '2026-06-15T00:00:00Z',
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
}

const matchB: MatchCardData = {
  id: 'match-b',
  homeTeamName: 'France',
  homeTeamShortName: 'FRA',
  homeTeamTla: 'FRA',
  homeTeamCrest: null,
  awayTeamName: 'Argentina',
  awayTeamShortName: 'ARG',
  awayTeamTla: 'ARG',
  awayTeamCrest: null,
  scheduledAt: '2026-06-15T03:00:00Z',
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
}

const matchC: MatchCardData = {
  id: 'match-c',
  homeTeamName: 'Spain',
  homeTeamShortName: 'ESP',
  homeTeamTla: 'ESP',
  homeTeamCrest: null,
  awayTeamName: 'Portugal',
  awayTeamShortName: 'POR',
  awayTeamTla: 'POR',
  awayTeamCrest: null,
  scheduledAt: '2026-06-16T00:00:00Z',
  status: 'SCHEDULED',
  stage: 'GROUP_STAGE',
}

describe('DateGroupedView', () => {
  it('renders nothing when matches is empty', () => {
    const { container } = render(<DateGroupedView matches={[]} dict={dict} lang="en" isApproved={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('groups two matches on the same local date under one heading', () => {
    // matchA and matchB both fall on 2026-06-15 UTC (UTC midnight and UTC+3h)
    render(<DateGroupedView matches={[matchA, matchB]} dict={dict} lang="en" isApproved={true} />)

    // Both teams from both matches should be visible
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
    expect(screen.getByText('France')).toBeInTheDocument()
    expect(screen.getByText('Argentina')).toBeInTheDocument()

    // There should be exactly one date heading (one group)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(1)
  })

  it('renders matches across two different dates under separate headings', () => {
    render(<DateGroupedView matches={[matchA, matchC]} dict={dict} lang="en" isApproved={true} />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(2)
  })

  it('renders matches in their input order within a date group', () => {
    render(<DateGroupedView matches={[matchA, matchB]} dict={dict} lang="en" isApproved={true} />)

    // Both matches render team names as text in order
    const germany = screen.getByText('Germany')
    const france = screen.getByText('France')
    const germanyCard = germany.closest('.rounded-xl')!
    const franceCard = france.closest('.rounded-xl')!
    // Germany card should appear before France card in the DOM
    expect(
      germanyCard.compareDocumentPosition(franceCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  // I2 — date boundary: two matches on clearly separate calendar dates in every timezone
  it('places matches on different calendar dates under separate date headings', () => {
    // 2026-06-15T12:00:00Z → June 15 local in every timezone (UTC-12 to UTC+14)
    const june15Match: MatchCardData = {
      id: 'june15',
      homeTeamName: 'Italy',
      homeTeamShortName: 'ITA',
      homeTeamTla: 'ITA',
      homeTeamCrest: null,
      awayTeamName: 'Mexico',
      awayTeamShortName: 'MEX',
      awayTeamTla: 'MEX',
      awayTeamCrest: null,
      scheduledAt: '2026-06-15T12:00:00Z',
      status: 'SCHEDULED',
      stage: 'GROUP_STAGE',
    }
    // 2026-06-16T12:00:00Z → June 16 local in every timezone (UTC-12 to UTC+14)
    const june16Match: MatchCardData = {
      id: 'june16',
      homeTeamName: 'Japan',
      homeTeamShortName: 'JPN',
      homeTeamTla: 'JPN',
      homeTeamCrest: null,
      awayTeamName: 'Croatia',
      awayTeamShortName: 'CRO',
      awayTeamTla: 'CRO',
      awayTeamCrest: null,
      scheduledAt: '2026-06-16T12:00:00Z',
      status: 'SCHEDULED',
      stage: 'GROUP_STAGE',
    }

    render(<DateGroupedView matches={[june15Match, june16Match]} dict={dict} lang="en" isApproved={true} />)

    // These two matches are 24 hours apart — any local timezone produces 2 separate date groups
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(2)
  })

  // I4 — sort within a date group: input order reversed, DOM order must be ascending
  it('renders matches within a date group sorted ascending by scheduledAt even when input is reversed', () => {
    // matchB (03:00) before matchA (00:00) — reversed input order
    render(<DateGroupedView matches={[matchB, matchA]} dict={dict} lang="en" isApproved={true} />)

    const germany = screen.getByText('Germany')
    const france = screen.getByText('France')
    const germanyCard = germany.closest('.rounded-xl')!
    const franceCard = france.closest('.rounded-xl')!

    // Germany (00:00) should appear before France (03:00) regardless of input order
    expect(
      germanyCard.compareDocumentPosition(franceCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  describe('lastFinishedMatchId / setTargetElement', () => {
    it('invokes setTargetElement only for the wrapper of the matching match id', () => {
      const setTargetElement = jest.fn()
      render(
        <DateGroupedView
          matches={[matchA, matchB]}
          dict={dict}
          lang="en"
          isApproved={true}
          lastFinishedMatchId="match-b"
          setTargetElement={setTargetElement}
        />,
      )

      // setTargetElement is called as a ref callback exactly once, with an HTMLElement
      expect(setTargetElement).toHaveBeenCalledTimes(1)
      expect(setTargetElement.mock.calls[0][0]).toBeInstanceOf(HTMLElement)

      // The wrapper passed should be an ancestor of France (matchB's team), not Germany (matchA's)
      const wrapperEl = setTargetElement.mock.calls[0][0] as HTMLElement
      expect(wrapperEl.contains(screen.getByText('France'))).toBe(true)
      expect(wrapperEl.contains(screen.getByText('Germany'))).toBe(false)
    })

    it('does not call setTargetElement when lastFinishedMatchId matches no match', () => {
      const setTargetElement = jest.fn()
      render(
        <DateGroupedView
          matches={[matchA, matchB]}
          dict={dict}
          lang="en"
          isApproved={true}
          lastFinishedMatchId="non-existent-id"
          setTargetElement={setTargetElement}
        />,
      )

      expect(setTargetElement).not.toHaveBeenCalled()
    })

    it('does not throw when lastFinishedMatchId and setTargetElement are omitted', () => {
      expect(() => {
        render(<DateGroupedView matches={[matchA, matchB]} dict={dict} lang="en" isApproved={true} />)
      }).not.toThrow()
    })
  })
})

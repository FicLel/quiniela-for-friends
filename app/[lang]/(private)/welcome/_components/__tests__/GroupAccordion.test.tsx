/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import GroupAccordion from '../GroupAccordion'
import type { MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'

const sampleMatches: MatchCardData[] = [
  {
    id: 'match-1',
    homeTeamName: 'Argentina',
    homeTeamShortName: 'ARG',
    homeTeamTla: 'ARG',
    homeTeamCrest: null,
    awayTeamName: 'France',
    awayTeamShortName: 'FRA',
    awayTeamTla: 'FRA',
    awayTeamCrest: null,
    scheduledAt: '2026-06-14T18:00:00Z',
    status: 'SCHEDULED',
    stage: 'GROUP_STAGE',
  },
]

const dict = enDict.welcome

describe('GroupAccordion', () => {
  it('renders collapsed by default (panel hidden)', () => {
    render(<GroupAccordion group="GROUP_A" matches={sampleMatches} dict={dict} lang="en" />)
    const panel = document.getElementById('group-panel-GROUP_A')
    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute('hidden')
  })

  it('renders the group label transformed from GROUP_A to "Group A"', () => {
    render(<GroupAccordion group="GROUP_A" matches={sampleMatches} dict={dict} lang="en" />)
    expect(screen.getByText('Group A')).toBeInTheDocument()
  })

  it('has aria-expanded="false" when collapsed', () => {
    render(<GroupAccordion group="GROUP_A" matches={sampleMatches} dict={dict} lang="en" />)
    const button = screen.getByRole('button', { name: /group a/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking the header expands the panel', () => {
    render(<GroupAccordion group="GROUP_A" matches={sampleMatches} dict={dict} lang="en" />)
    const button = screen.getByRole('button', { name: /group a/i })

    fireEvent.click(button)

    const panel = document.getElementById('group-panel-GROUP_A')
    expect(panel).not.toHaveAttribute('hidden')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('clicking again collapses the panel', () => {
    render(<GroupAccordion group="GROUP_A" matches={sampleMatches} dict={dict} lang="en" />)
    const button = screen.getByRole('button', { name: /group a/i })

    fireEvent.click(button)
    fireEvent.click(button)

    const panel = document.getElementById('group-panel-GROUP_A')
    expect(panel).toHaveAttribute('hidden')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders with defaultOpen=true showing match cards immediately', () => {
    render(
      <GroupAccordion
        group="GROUP_B"
        matches={sampleMatches}
        defaultOpen={true}
        dict={dict}
        lang="en"
      />,
    )
    const panel = document.getElementById('group-panel-GROUP_B')
    expect(panel).not.toHaveAttribute('hidden')
    expect(screen.getByText('Argentina')).toBeInTheDocument()
  })
})

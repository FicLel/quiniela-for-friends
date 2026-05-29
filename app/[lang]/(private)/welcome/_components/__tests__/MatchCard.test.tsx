/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import MatchCard, { type MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'

const baseMatch: MatchCardData = {
  id: 'match-1',
  homeTeamName: 'Germany',
  homeTeamShortName: 'GER',
  homeTeamTla: 'GER',
  homeTeamCrest: 'https://crests.example.com/ger.svg',
  awayTeamName: 'Brazil',
  awayTeamShortName: 'BRA',
  awayTeamTla: 'BRA',
  awayTeamCrest: 'https://crests.example.com/bra.svg',
  scheduledAt: '2026-06-15T15:00:00Z',
  status: 'SCHEDULED',
}

const dict = enDict.welcome

describe('MatchCard', () => {
  it('renders home and away team names', () => {
    render(<MatchCard {...baseMatch} dict={dict} lang="en" />)
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
  })

  it('renders a placeholder element containing the TLA when homeTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} homeTeamCrest={null} dict={dict} lang="en" />)
    expect(screen.getByLabelText('GER')).toBeInTheDocument()
  })

  it('renders an <img> with the correct src when a crest URL is provided', () => {
    render(<MatchCard {...baseMatch} dict={dict} lang="en" />)
    const homeImg = screen.getByAltText('Germany') as HTMLImageElement
    expect(homeImg.tagName).toBe('IMG')
    expect(homeImg.src).toBe('https://crests.example.com/ger.svg')
  })

  it('shows match status label from dict', () => {
    render(<MatchCard {...baseMatch} status="FINISHED" dict={dict} lang="en" />)
    expect(screen.getByText(dict.status.FINISHED)).toBeInTheDocument()
  })

  it('renders status text with underscores replaced by spaces for unknown status', () => {
    render(<MatchCard {...baseMatch} status="IN_PLAY" dict={dict} lang="en" />)
    expect(screen.getByText(dict.status.IN_PLAY)).toBeInTheDocument()
  })

  it('renders the away team TLA placeholder when awayTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} awayTeamCrest={null} dict={dict} lang="en" />)
    expect(screen.getByLabelText('BRA')).toBeInTheDocument()
  })
})

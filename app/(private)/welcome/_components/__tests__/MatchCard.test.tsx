/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import MatchCard, { type MatchCardData } from '../MatchCard'

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

describe('MatchCard', () => {
  it('renders home and away team names', () => {
    render(<MatchCard {...baseMatch} />)
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
  })

  it('renders a placeholder element containing the TLA when homeTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} homeTeamCrest={null} />)
    // The placeholder div shows the TLA text
    expect(screen.getByLabelText('GER')).toBeInTheDocument()
  })

  it('renders an <img> with the correct src when a crest URL is provided', () => {
    render(<MatchCard {...baseMatch} />)
    const homeImg = screen.getByAltText('Germany') as HTMLImageElement
    expect(homeImg.tagName).toBe('IMG')
    expect(homeImg.src).toBe('https://crests.example.com/ger.svg')
  })

  it('shows match status', () => {
    render(<MatchCard {...baseMatch} status="FINISHED" />)
    expect(screen.getByText('FINISHED')).toBeInTheDocument()
  })

  it('renders status text with underscores replaced by spaces', () => {
    render(<MatchCard {...baseMatch} status="IN_PLAY" />)
    expect(screen.getByText('IN PLAY')).toBeInTheDocument()
  })

  it('renders the away team TLA placeholder when awayTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} awayTeamCrest={null} />)
    expect(screen.getByLabelText('BRA')).toBeInTheDocument()
  })
})

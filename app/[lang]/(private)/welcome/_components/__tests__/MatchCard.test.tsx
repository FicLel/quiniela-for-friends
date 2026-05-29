/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react'
import MatchCard, { type MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'
import esDict from '@/i18n/dictionaries/es.json'

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
  stage: 'GROUP_STAGE',
}

const enWelcome = enDict.welcome
const esWelcome = esDict.welcome

describe('MatchCard', () => {
  // -------------------------------------------------------------------------
  // Team names and crests
  // -------------------------------------------------------------------------

  it('renders home and away team names', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
  })

  it('renders TLA placeholder when homeTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} homeTeamCrest={null} dict={enWelcome} lang="en" />)
    expect(screen.getByLabelText('GER')).toBeInTheDocument()
  })

  it('renders TLA placeholder when awayTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} awayTeamCrest={null} dict={enWelcome} lang="en" />)
    expect(screen.getByLabelText('BRA')).toBeInTheDocument()
  })

  it('renders <img> with correct src when a crest URL is provided', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const homeImg = screen.getByAltText('Germany') as HTMLImageElement
    expect(homeImg.tagName).toBe('IMG')
    expect(homeImg.src).toBe('https://crests.example.com/ger.svg')
  })

  it('crest images have rounded-full and ring-2 classes', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const homeImg = screen.getByAltText('Germany')
    expect(homeImg.className).toContain('rounded-full')
    expect(homeImg.className).toContain('ring-2')
  })

  // -------------------------------------------------------------------------
  // Status badge
  // -------------------------------------------------------------------------

  it('shows match status label from dict', () => {
    render(<MatchCard {...baseMatch} status="FINISHED" dict={enWelcome} lang="en" />)
    expect(screen.getByText(enWelcome.status.FINISHED)).toBeInTheDocument()
  })

  it('shows IN_PLAY status label from dict', () => {
    render(<MatchCard {...baseMatch} status="IN_PLAY" dict={enWelcome} lang="en" />)
    expect(screen.getByText(enWelcome.status.IN_PLAY)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Score counters — vertical box widget
  // -------------------------------------------------------------------------

  it('renders two counters starting at 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  it('increment button increases the home counter', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const increment = screen.getByLabelText('Increase Germany score')
    fireEvent.click(increment)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('increment button increases the away counter independently', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const increment = screen.getByLabelText('Increase Brazil score')
    fireEvent.click(increment)
    fireEvent.click(increment)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('decrement button is disabled when counter is 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const decrement = screen.getByLabelText('Decrease Germany score')
    expect(decrement).toBeDisabled()
  })

  it('decrement does not go below 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const decrement = screen.getByLabelText('Decrease Germany score')
    fireEvent.click(decrement) // no-op — disabled
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  it('decrement button becomes enabled after incrementing', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    const increment = screen.getByLabelText('Increase Germany score')
    const decrement = screen.getByLabelText('Decrease Germany score')

    fireEvent.click(increment)
    expect(decrement).not.toBeDisabled()

    fireEvent.click(decrement)
    expect(decrement).toBeDisabled()
  })

  it('each counter has an up (increment) and down (decrement) button', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    expect(screen.getByLabelText('Increase Germany score')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease Germany score')).toBeInTheDocument()
    expect(screen.getByLabelText('Increase Brazil score')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease Brazil score')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Win badge — language-aware, positioned below each team
  // -------------------------------------------------------------------------

  it('shows "W" win label twice in English', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    expect(screen.getAllByText(enWelcome.winLabel)).toHaveLength(2)
  })

  it('shows "V" win label twice in Spanish', () => {
    render(<MatchCard {...baseMatch} dict={esWelcome} lang="es" />)
    expect(screen.getAllByText(esWelcome.winLabel)).toHaveLength(2)
  })

  it('shows 50% probability for both teams', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" />)
    expect(screen.getAllByText('50%')).toHaveLength(2)
  })
})

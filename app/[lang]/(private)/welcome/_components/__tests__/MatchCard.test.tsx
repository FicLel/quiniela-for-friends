/** @jest-environment jsdom */
import { act, render, screen, fireEvent } from '@testing-library/react'
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
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
  })

  it('renders TLA placeholder when homeTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} homeTeamCrest={null} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByLabelText('GER')).toBeInTheDocument()
  })

  it('renders TLA placeholder when awayTeamCrest is null', () => {
    render(<MatchCard {...baseMatch} awayTeamCrest={null} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByLabelText('BRA')).toBeInTheDocument()
  })

  it('renders <img> with correct src when a crest URL is provided', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const homeImg = screen.getByAltText('Germany') as HTMLImageElement
    expect(homeImg.tagName).toBe('IMG')
    expect(homeImg.src).toBe('https://crests.example.com/ger.svg')
  })

  it('crest images have rounded-full and ring-2 classes', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const homeImg = screen.getByAltText('Germany')
    expect(homeImg.className).toContain('rounded-full')
    expect(homeImg.className).toContain('ring-2')
  })

  // -------------------------------------------------------------------------
  // Status badge
  // -------------------------------------------------------------------------

  it('shows match status label from dict', () => {
    render(<MatchCard {...baseMatch} status="FINISHED" dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByText(enWelcome.status.FINISHED)).toBeInTheDocument()
  })

  it('shows IN_PLAY status label from dict', () => {
    render(<MatchCard {...baseMatch} status="IN_PLAY" dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByText(enWelcome.status.IN_PLAY)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Score counters — vertical box widget
  // -------------------------------------------------------------------------

  it('renders two counters starting at 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  it('increment button increases the home counter', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const increment = screen.getByLabelText('Increase Germany score')
    fireEvent.click(increment)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('increment button increases the away counter independently', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const increment = screen.getByLabelText('Increase Brazil score')
    fireEvent.click(increment)
    fireEvent.click(increment)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('decrement button is disabled when counter is 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const decrement = screen.getByLabelText('Decrease Germany score')
    expect(decrement).toBeDisabled()
  })

  it('decrement does not go below 0', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const decrement = screen.getByLabelText('Decrease Germany score')
    fireEvent.click(decrement) // no-op — disabled
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  it('decrement button becomes enabled after incrementing', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    const increment = screen.getByLabelText('Increase Germany score')
    const decrement = screen.getByLabelText('Decrease Germany score')

    fireEvent.click(increment)
    expect(decrement).not.toBeDisabled()

    fireEvent.click(decrement)
    expect(decrement).toBeDisabled()
  })

  it('each counter has an up (increment) and down (decrement) button', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getByLabelText('Increase Germany score')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease Germany score')).toBeInTheDocument()
    expect(screen.getByLabelText('Increase Brazil score')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease Brazil score')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Win badge — language-aware, positioned below each team
  // -------------------------------------------------------------------------

  it('shows "W" win label twice in English', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getAllByText(enWelcome.winLabel)).toHaveLength(2)
  })

  it('shows "V" win label twice in Spanish', () => {
    render(<MatchCard {...baseMatch} dict={esWelcome} lang="es" isApproved={true} />)
    expect(screen.getAllByText(esWelcome.winLabel)).toHaveLength(2)
  })

  it('shows 50% probability for both teams', () => {
    render(<MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />)
    expect(screen.getAllByText('50%')).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // ScoreCounter — initialValue
  // -------------------------------------------------------------------------

  it('counter initializes to initialValue when provided', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        initialHomeScore={3}
        initialAwayScore={1}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('initialValue = 0 behaves identically to no initialValue', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        initialHomeScore={0}
        initialAwayScore={0}
      />,
    )
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })

  // -------------------------------------------------------------------------
  // ScoreCounter — onSave with debounce
  // -------------------------------------------------------------------------

  it('onSaveScore fires after 500ms debounce following an increment', () => {
    jest.useFakeTimers()
    const onSaveScore = jest.fn().mockResolvedValue(undefined)

    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        onSaveScore={onSaveScore}
      />,
    )

    fireEvent.click(screen.getByLabelText('Increase Germany score'))
    expect(onSaveScore).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(onSaveScore).toHaveBeenCalledTimes(1)
    expect(onSaveScore).toHaveBeenCalledWith('match-1', 1, 0)

    jest.useRealTimers()
  })

  it('onSaveScore fires immediately on blur and cancels pending debounce (called exactly once)', () => {
    jest.useFakeTimers()
    const onSaveScore = jest.fn().mockResolvedValue(undefined)

    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        onSaveScore={onSaveScore}
      />,
    )

    const incrementBtn = screen.getByLabelText('Increase Germany score')
    fireEvent.click(incrementBtn)

    // Blur the counter widget before 500ms — should fire immediately
    fireEvent.blur(incrementBtn, { relatedTarget: null })
    expect(onSaveScore).toHaveBeenCalledTimes(1)
    expect(onSaveScore).toHaveBeenCalledWith('match-1', 1, 0)

    // Advance timers — debounce should have been cancelled; no second call
    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(onSaveScore).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  it('rapid increments followed by blur call onSaveScore exactly once with final value', () => {
    jest.useFakeTimers()
    const onSaveScore = jest.fn().mockResolvedValue(undefined)

    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        onSaveScore={onSaveScore}
      />,
    )

    const incrementBtn = screen.getByLabelText('Increase Germany score')
    fireEvent.click(incrementBtn)
    fireEvent.click(incrementBtn)
    fireEvent.click(incrementBtn)

    fireEvent.blur(incrementBtn, { relatedTarget: null })
    expect(onSaveScore).toHaveBeenCalledTimes(1)
    expect(onSaveScore).toHaveBeenCalledWith('match-1', 3, 0)

    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(onSaveScore).toHaveBeenCalledTimes(1)

    jest.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // ScoreCounter — disabled state
  // -------------------------------------------------------------------------

  it('when isApproved=false all counter buttons are disabled', () => {
    render(
      <MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={false} />,
    )
    expect(screen.getByLabelText('Increase Germany score')).toBeDisabled()
    expect(screen.getByLabelText('Decrease Germany score')).toBeDisabled()
    expect(screen.getByLabelText('Increase Brazil score')).toBeDisabled()
    expect(screen.getByLabelText('Decrease Brazil score')).toBeDisabled()
  })

  it('when isApproved=false clicking increment does NOT call onSaveScore', () => {
    jest.useFakeTimers()
    const onSaveScore = jest.fn().mockResolvedValue(undefined)

    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={false}
        onSaveScore={onSaveScore}
      />,
    )

    // Attempt clicks on disabled buttons — HTML disabled prevents events, but guard still applies
    const incrementBtn = screen.getByLabelText('Increase Germany score')
    fireEvent.click(incrementBtn)

    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(onSaveScore).not.toHaveBeenCalled()

    jest.useRealTimers()
  })

  it('when isApproved=false increment buttons have opacity-50 and cursor-not-allowed classes', () => {
    render(
      <MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={false} />,
    )
    const incrementBtn = screen.getByLabelText('Increase Germany score')
    expect(incrementBtn.className).toContain('opacity-50')
    expect(incrementBtn.className).toContain('cursor-not-allowed')
  })

  it('when isApproved=true (default enabled) buttons are interactive', () => {
    render(
      <MatchCard {...baseMatch} dict={enWelcome} lang="en" isApproved={true} />,
    )
    const incrementBtn = screen.getByLabelText('Increase Germany score')
    expect(incrementBtn).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // ScoreCounter — cross-counter: both sides reflected in save call
  // -------------------------------------------------------------------------

  it('onSaveScore receives correct values for both sides when home=2 away=1', () => {
    const onSaveScore = jest.fn().mockResolvedValue(undefined)

    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        onSaveScore={onSaveScore}
      />,
    )

    const incrementHome = screen.getByLabelText('Increase Germany score')
    const incrementAway = screen.getByLabelText('Increase Brazil score')

    // Increment home twice → home score = 2
    fireEvent.click(incrementHome)
    fireEvent.click(incrementHome)

    // Increment away once → away score = 1
    fireEvent.click(incrementAway)

    // Blur the away counter first — commits away=1 into the shared awayScoreRef
    fireEvent.blur(incrementAway, { relatedTarget: null })

    // Blur the home counter — save includes home=2 and the committed away=1
    fireEvent.blur(incrementHome, { relatedTarget: null })

    // The last call to onSaveScore must include both correct values
    expect(onSaveScore).toHaveBeenCalledWith('match-1', 2, 1)
  })
})

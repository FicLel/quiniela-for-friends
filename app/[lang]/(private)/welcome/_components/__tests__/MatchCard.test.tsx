/** @jest-environment jsdom */
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import MatchCard, { type MatchCardData } from '../MatchCard'
import enDict from '@/i18n/dictionaries/en.json'
import esDict from '@/i18n/dictionaries/es.json'

const mockRouterRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}))

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

  it('shows "W" win label twice in English when crowd data is provided', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        crowdHomeWinPct={50}
        crowdDrawPct={25}
        crowdAwayWinPct={25}
      />,
    )
    expect(screen.getAllByText(enWelcome.winLabel)).toHaveLength(2)
  })

  it('shows "V" win label twice in Spanish when crowd data is provided', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={esWelcome}
        lang="es"
        isApproved={true}
        crowdHomeWinPct={50}
        crowdDrawPct={25}
        crowdAwayWinPct={25}
      />,
    )
    expect(screen.getAllByText(esWelcome.winLabel)).toHaveLength(2)
  })

  it('shows crowd percentages when provided', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        crowdHomeWinPct={60}
        crowdDrawPct={10}
        crowdAwayWinPct={30}
      />,
    )
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
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

  // -------------------------------------------------------------------------
  // Final state (official result synced)
  // -------------------------------------------------------------------------

  it('when regulationHomeGoals is set, shows official score instead of counters', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        regulationHomeGoals={3}
        regulationAwayGoals={1}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    // Score counter increment buttons should NOT be present
    expect(screen.queryByLabelText('Increase Germany score')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Increase Brazil score')).not.toBeInTheDocument()
  })

  it('when regulationHomeGoals is set, shows predicted score as secondary label', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        regulationHomeGoals={2}
        regulationAwayGoals={0}
        initialHomeScore={1}
        initialAwayScore={0}
      />,
    )
    // Official score values
    expect(screen.getByText('2')).toBeInTheDocument()
    // Predicted score label
    const prediction = screen.getByLabelText('Your prediction')
    expect(prediction).toBeInTheDocument()
    expect(prediction.textContent).toContain('1')
    expect(prediction.textContent).toContain('0')
  })

  it('shows earnedPoints badge with correct value (3 points)', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        regulationHomeGoals={2}
        regulationAwayGoals={1}
        earnedPoints={3}
      />,
    )
    expect(screen.getByText('+3 pts')).toBeInTheDocument()
  })

  it('shows earnedPoints badge with 0 points', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        regulationHomeGoals={2}
        regulationAwayGoals={1}
        earnedPoints={0}
      />,
    )
    expect(screen.getByText('+0 pts')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Locked state
  // -------------------------------------------------------------------------

  it('when isLocked=true, counter buttons are disabled', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        isLocked={true}
      />,
    )
    expect(screen.getByLabelText('Increase Germany score')).toBeDisabled()
    expect(screen.getByLabelText('Increase Brazil score')).toBeDisabled()
  })

  it('when isLocked=true, shows "Predictions closed" label', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        isLocked={true}
      />,
    )
    expect(screen.getByText('Predictions closed')).toBeInTheDocument()
  })

  it('shows "No predictions yet" when all crowd percentages are null', () => {
    render(
      <MatchCard
        {...baseMatch}
        dict={enWelcome}
        lang="en"
        isApproved={true}
        crowdHomeWinPct={null}
        crowdDrawPct={null}
        crowdAwayWinPct={null}
      />,
    )
    expect(screen.getByText('No predictions yet')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Admin: official result editor
  // -------------------------------------------------------------------------

  describe('admin result editor', () => {
    beforeEach(() => {
      mockRouterRefresh.mockClear()
    })

    it('does not render the official result editor for userRole="player"', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="player"
          onSyncResult={onSyncResult}
        />,
      )
      expect(screen.queryByText('Official result')).not.toBeInTheDocument()
    })

    it('does not render the official result editor when userRole is undefined', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          onSyncResult={onSyncResult}
        />,
      )
      expect(screen.queryByText('Official result')).not.toBeInTheDocument()
    })

    it('does not render the official result editor when onSyncResult is not provided', () => {
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
        />,
      )
      expect(screen.queryByText('Official result')).not.toBeInTheDocument()
    })

    it('renders the official result editor for userRole="admin", pre-filled with the regulation score', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
          regulationHomeGoals={2}
          regulationAwayGoals={1}
        />,
      )
      expect(screen.getByText('Official result')).toBeInTheDocument()
      expect(screen.getByLabelText('Germany official goals')).toHaveValue(2)
      expect(screen.getByLabelText('Brazil official goals')).toHaveValue(1)
    })

    it('renders empty inputs and the "Save result" label when the match has no official result yet', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
        />,
      )
      expect(screen.getByLabelText('Germany official goals')).toHaveValue(null)
      expect(screen.getByLabelText('Brazil official goals')).toHaveValue(null)
      expect(screen.getByRole('button', { name: 'Save result' })).toBeInTheDocument()
    })

    it('shows the "Update result" label when the match already has an official result', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
          regulationHomeGoals={2}
          regulationAwayGoals={1}
        />,
      )
      expect(screen.getByRole('button', { name: 'Update result' })).toBeInTheDocument()
    })

    it('calls onSyncResult with the entered scores when "Save result" is clicked', async () => {
      const onSyncResult = jest.fn().mockResolvedValue({ success: true, matchesUpdated: 1, scoresUpdated: 2 })
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
        />,
      )

      fireEvent.change(screen.getByLabelText('Germany official goals'), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText('Brazil official goals'), { target: { value: '1' } })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save result' }))
      })

      expect(onSyncResult).toHaveBeenCalledWith('match-1', 3, 1)
    })

    it('shows a success message and refreshes the router when the save succeeds', async () => {
      const onSyncResult = jest.fn().mockResolvedValue({ success: true, matchesUpdated: 1, scoresUpdated: 2 })
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
          regulationHomeGoals={2}
          regulationAwayGoals={1}
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Update result' }))
      })

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Result saved — points updated.')
      })
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
    })

    it('shows a mapped error message and does not refresh the router when the save fails', async () => {
      const onSyncResult = jest.fn().mockResolvedValue({ success: false, error: 'DB_ERROR' })
      render(
        <MatchCard
          {...baseMatch}
          dict={enWelcome}
          lang="en"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
          regulationHomeGoals={2}
          regulationAwayGoals={1}
        />,
      )

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Update result' }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(enWelcome.syncResultErrors.DB_ERROR)
      })
      expect(mockRouterRefresh).not.toHaveBeenCalled()
    })

    it('renders the editor in Spanish using the es dictionary', () => {
      const onSyncResult = jest.fn()
      render(
        <MatchCard
          {...baseMatch}
          dict={esWelcome}
          lang="es"
          isApproved={true}
          userRole="admin"
          onSyncResult={onSyncResult}
        />,
      )
      expect(screen.getByText(esWelcome.officialResultLabel)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: esWelcome.saveResultButton })).toBeInTheDocument()
    })
  })
})

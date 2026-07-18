/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminExtraQuestionsClient from '../AdminExtraQuestionsClient'
import type { ExtraQuestion } from '@/extraQuestions/extraQuestions.types'

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// ---------------------------------------------------------------------------
// Mock server actions
// ---------------------------------------------------------------------------
jest.mock('@/extraQuestions/actions', () => ({
  createQuestion: jest.fn(),
  resolveQuestion: jest.fn(),
  listAnswersForReview: jest.fn(),
  overrideAnswer: jest.fn(),
  updateQuestionDeadline: jest.fn(),
}))

// Import after mocking so we can configure the mock per-test
import {
  createQuestion,
  resolveQuestion,
  listAnswersForReview,
  overrideAnswer,
  updateQuestionDeadline,
} from '@/extraQuestions/actions'

// ---------------------------------------------------------------------------
// Mock autocomplete children (they do fetch on mount — keep them simple)
// ---------------------------------------------------------------------------
jest.mock('../TeamAutocomplete', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      data-testid="team-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}))

jest.mock('../PlayerAutocomplete', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      data-testid="player-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseQuestion: ExtraQuestion = {
  id: 'q-1',
  quinielaId: 'quiniela-1',
  questionText: 'Who will win the Golden Boot?',
  questionType: 'player',
  status: 'unresolved',
  correctAnswer: null,
  createdBy: 'user-admin-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  pointsValue: 1,
  answerDeadline: null,
}

const resolvedQuestion: ExtraQuestion = {
  ...baseQuestion,
  id: 'q-2',
  questionText: 'Which team wins the tournament?',
  questionType: 'team',
  status: 'resolved',
  correctAnswer: 'Argentina',
}

const defaultProps = {
  questions: [],
  hasCompetitionData: true,
  quinielaId: 'quiniela-1',
  lang: 'en',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AdminExtraQuestionsClient', () => {
  // -------------------------------------------------------------------------
  // Competition data banner
  // -------------------------------------------------------------------------

  it('shows competition data banner when hasCompetitionData === false', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={false} />)
    expect(
      screen.getByText(/Competition data must be loaded before creating extra questions/),
    ).toBeInTheDocument()
  })

  it('does not show create button when hasCompetitionData === false', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={false} />)
    expect(screen.queryByText('+ Create Question')).not.toBeInTheDocument()
  })

  it('does not show competition data banner when hasCompetitionData === true', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} hasCompetitionData={true} />)
    expect(screen.queryByText(/Competition data must be loaded/)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Create button and form toggle
  // -------------------------------------------------------------------------

  it('shows create button when hasCompetitionData === true', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    expect(screen.getByText('+ Create Question')).toBeInTheDocument()
  })

  it('toggles create form when create button is clicked', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    expect(screen.getByText('New Question')).toBeInTheDocument()
    expect(screen.queryByText('+ Create Question')).not.toBeInTheDocument()
  })

  it('hides create form when Cancel is clicked', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('New Question')).not.toBeInTheDocument()
    expect(screen.getByText('+ Create Question')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Create form submission
  // -------------------------------------------------------------------------

  it('calls createQuestion with correct args on form submit, defaulting pointsValue to 1 and answerDeadline to null', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({ success: true, question: baseQuestion })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))

    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Who will win?' },
    })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(createQuestion).toHaveBeenCalledWith('quiniela-1', {
        questionText: 'Who will win?',
        questionType: 'team',
        pointsValue: 1,
        answerDeadline: null,
      })
    })
  })

  it('submits a custom pointsValue and converts a filled-in answerDeadline to an ISO string', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({ success: true, question: baseQuestion })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))

    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Who will win?' },
    })
    fireEvent.change(screen.getByLabelText(/Points value/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/Answer deadline/i), {
      target: { value: '2026-08-01T10:00' },
    })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(createQuestion).toHaveBeenCalledWith('quiniela-1', {
        questionText: 'Who will win?',
        questionType: 'team',
        pointsValue: 5,
        answerDeadline: new Date('2026-08-01T10:00').toISOString(),
      })
    })
  })

  it('disables Create and does not call createQuestion when pointsValue is invalid', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))

    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Who will win?' },
    })
    fireEvent.change(screen.getByLabelText(/Points value/i), { target: { value: '0' } })

    expect(screen.getByText('Create')).toBeDisabled()
  })

  it('shows inline error when createQuestion returns INVALID_INPUT', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({ success: false, error: 'INVALID_INPUT' })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Some question' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid input/)
    })
  })

  it('shows inline error when createQuestion returns NO_COMPETITION_DATA', async () => {
    ;(createQuestion as jest.Mock).mockResolvedValue({
      success: false,
      error: 'NO_COMPETITION_DATA',
    })

    render(<AdminExtraQuestionsClient {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Create Question'))
    fireEvent.change(screen.getByLabelText(/Question text/i), {
      target: { value: 'Some question' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Competition data is not available/)
    })
  })

  // -------------------------------------------------------------------------
  // Resolve form
  // -------------------------------------------------------------------------

  it('renders unresolved question with resolve button', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    expect(screen.getByText('Who will win the Golden Boot?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  it('renders resolved question with Save button and correct answer pre-filled', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    expect(screen.getByText('Which team wins the tournament?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByTestId('team-autocomplete')).toHaveValue('Argentina')
  })

  it('calls resolveQuestion with correct args when Resolve button clicked', async () => {
    ;(resolveQuestion as jest.Mock).mockResolvedValue({ success: true, membersRescored: 3 })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)

    // Type into the mocked autocomplete
    fireEvent.change(screen.getByTestId('player-autocomplete'), {
      target: { value: 'Lionel Messi' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    await waitFor(() => {
      expect(resolveQuestion).toHaveBeenCalledWith('quiniela-1', 'q-1', 'Lionel Messi')
    })
  })

  it('shows inline AUDIT_FAILED error when resolveQuestion returns AUDIT_FAILED', async () => {
    ;(resolveQuestion as jest.Mock).mockResolvedValue({ success: false, error: 'AUDIT_FAILED' })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)

    fireEvent.change(screen.getByTestId('player-autocomplete'), {
      target: { value: 'Some Player' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to write audit log/)
    })
  })

  // -------------------------------------------------------------------------
  // Edit deadline
  // -------------------------------------------------------------------------

  it('shows "No deadline set" for a question without a deadline', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    expect(screen.getByText('No deadline set')).toBeInTheDocument()
  })

  it('shows the formatted deadline for a question that has one', () => {
    const withDeadline = { ...baseQuestion, answerDeadline: new Date('2026-08-01T10:00:00Z') }
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[withDeadline]} />)
    expect(screen.getByText(withDeadline.answerDeadline!.toLocaleString())).toBeInTheDocument()
  })

  it('reveals the deadline input when Edit is clicked', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByLabelText(/Answer deadline/i)).toBeInTheDocument()
  })

  it('calls updateQuestionDeadline with an ISO string when a deadline is set and saved', async () => {
    ;(updateQuestionDeadline as jest.Mock).mockResolvedValue({ success: true, question: baseQuestion })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    fireEvent.click(screen.getByText('Edit'))

    fireEvent.change(screen.getByLabelText(/Answer deadline/i), {
      target: { value: '2026-08-01T10:00' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(updateQuestionDeadline).toHaveBeenCalledWith(
        'quiniela-1',
        'q-1',
        new Date('2026-08-01T10:00').toISOString(),
      )
    })
  })

  it('calls updateQuestionDeadline with null when the deadline is cleared and saved', async () => {
    const withDeadline = { ...baseQuestion, answerDeadline: new Date('2026-08-01T10:00:00Z') }
    ;(updateQuestionDeadline as jest.Mock).mockResolvedValue({ success: true, question: withDeadline })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[withDeadline]} />)
    fireEvent.click(screen.getByText('Edit'))

    fireEvent.change(screen.getByLabelText(/Answer deadline/i), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(updateQuestionDeadline).toHaveBeenCalledWith('quiniela-1', 'q-1', null)
    })
  })

  it('hides the input again after a successful save', async () => {
    ;(updateQuestionDeadline as jest.Mock).mockResolvedValue({ success: true, question: baseQuestion })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.queryByLabelText(/Answer deadline/i)).not.toBeInTheDocument()
    })
  })

  it('hides the input when Cancel is clicked without saving', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByLabelText(/Answer deadline/i)).not.toBeInTheDocument()
    expect(updateQuestionDeadline).not.toHaveBeenCalled()
  })

  it('shows an inline error when updateQuestionDeadline returns INVALID_INPUT', async () => {
    ;(updateQuestionDeadline as jest.Mock).mockResolvedValue({ success: false, error: 'INVALID_INPUT' })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Deadline must be in the future/)
    })
  })

  it('allows editing the deadline on a resolved question', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when there are no questions', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[]} />)
    expect(screen.getByText(/No extra questions yet/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Review answers section
  // -------------------------------------------------------------------------

  const reviewRows = [
    {
      userId: 'user-1',
      userEmail: 'alice@example.com',
      answerText: 'Lionel Messi',
      submittedAt: new Date('2026-06-01'),
      points: 1,
      isCorrect: true,
      isOverridden: false,
      overriddenBy: null,
      overriddenAt: null,
    },
    {
      userId: 'user-2',
      userEmail: 'bob@example.com',
      answerText: null,
      submittedAt: null,
      points: 0,
      isCorrect: false,
      isOverridden: false,
      overriddenBy: null,
      overriddenAt: null,
    },
  ]

  it('does not show a Review answers control for unresolved questions', () => {
    render(<AdminExtraQuestionsClient {...defaultProps} questions={[baseQuestion]} />)
    expect(screen.queryByText('Review answers')).not.toBeInTheDocument()
  })

  it('lazily loads and renders answers when Review answers is clicked', async () => {
    ;(listAnswersForReview as jest.Mock).mockResolvedValue({ success: true, rows: reviewRows })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)

    expect(listAnswersForReview).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Review answers'))

    expect(listAnswersForReview).toHaveBeenCalledWith('quiniela-1', 'q-2')

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    expect(screen.getByText('Lionel Messi')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('No answer')).toBeInTheDocument()
  })

  it('shows an error when listAnswersForReview fails', async () => {
    ;(listAnswersForReview as jest.Mock).mockResolvedValue({
      success: false,
      error: 'DB_ERROR',
    })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    fireEvent.click(screen.getByText('Review answers'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to load answers/)
    })
  })

  it('calls overrideAnswer with correct args and marks the row overridden on success', async () => {
    ;(listAnswersForReview as jest.Mock).mockResolvedValue({ success: true, rows: reviewRows })
    ;(overrideAnswer as jest.Mock).mockResolvedValue({ success: true, points: 1, isCorrect: true })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    fireEvent.click(screen.getByText('Review answers'))

    await waitFor(() => {
      expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    })

    const markCorrectButtons = screen.getAllByRole('button', { name: 'Mark correct' })
    // Second row belongs to bob (index 1)
    fireEvent.click(markCorrectButtons[1])

    await waitFor(() => {
      expect(overrideAnswer).toHaveBeenCalledWith('quiniela-1', 'q-2', 'user-2', true)
    })

    await waitFor(() => {
      expect(screen.getByText('(overridden)')).toBeInTheDocument()
    })
  })

  it('shows an inline error when overrideAnswer returns IMPERSONATING_READ_ONLY', async () => {
    ;(listAnswersForReview as jest.Mock).mockResolvedValue({ success: true, rows: reviewRows })
    ;(overrideAnswer as jest.Mock).mockResolvedValue({
      success: false,
      error: 'IMPERSONATING_READ_ONLY',
    })

    render(<AdminExtraQuestionsClient {...defaultProps} questions={[resolvedQuestion]} />)
    fireEvent.click(screen.getByText('Review answers'))

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark incorrect' })[0])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/impersonating in read-only mode/)
    })
  })
})
